package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

func handleTmdbDetail(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}

	q := r.URL.Query()
	mediaType := q.Get("type")
	if mediaType == "" {
		mediaType = "movie"
	}
	tmdbID := q.Get("id")
	if tmdbID == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro id é obrigatório", "")
		return
	}

	tmdbMedia := "movie"
	if mediaType != "movie" {
		tmdbMedia = "tv"
	}

	storageKey := fmt.Sprintf("%s:%s", tmdbMedia, tmdbID)

	// 1. Tenta pegar metadados persistentes limpos
	stored, err := DbCache.MediaMetadataGet(storageKey)
	if err == nil && len(stored) > 0 {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("X-Cache", "STORE")
		_, _ = w.Write(stored)
		return
	}

	// 2. Tenta pegar do cache comum
	cacheKey := fmt.Sprintf("tmdb:%s:%s:pt-BR", tmdbMedia, tmdbID)
	status, contentType, body, expiresAt, err := DbCache.ApiCacheGet(cacheKey)
	if err == nil && expiresAt > time.Now().Unix() {
		if status == http.StatusOK {
			_ = DbCache.MediaMetadataSet(storageKey, tmdbMedia, tmdbID, body, time.Now().Unix())
			go warmTmdbImages(body)
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(status)
		_, _ = w.Write(body)
		return
	}

	// 3. Busca no TMDB remoto
	urlStr := fmt.Sprintf("%s/%s/%s?api_key=%s&language=pt-BR", TmdbBase, tmdbMedia, tmdbID, getTmdbApiKey())
	client := http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", urlStr, nil)
	req.Header.Set("User-Agent", "MeuPlayer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		sendJSONError(w, http.StatusBadGateway, "Falha ao acessar o TMDB", err.Error())
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		sendJSONError(w, http.StatusBadGateway, "Falha ao ler resposta do TMDB", err.Error())
		return
	}

	if resp.StatusCode == http.StatusOK {
		now := time.Now().Unix()
		_ = DbCache.ApiCacheSet(cacheKey, resp.StatusCode, "application/json; charset=utf-8", respBody, now+TtlTmdbDetailsSeconds, now)
		_ = DbCache.MediaMetadataSet(storageKey, tmdbMedia, tmdbID, respBody, now)
		go warmTmdbImages(respBody)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(respBody)
}

// Pre-fetch de Imagens do TMDB (Posters e Backdrops) em background
func warmTmdbImages(metaBytes []byte) {
	var meta map[string]interface{}
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		return
	}

	var paths []string
	if poster, ok := meta["poster_path"].(string); ok && poster != "" {
		paths = append(paths, poster)
	}
	if backdrop, ok := meta["backdrop_path"].(string); ok && backdrop != "" {
		paths = append(paths, backdrop)
	}

	for i, relPath := range paths {
		size := "w500"
		if i > 0 {
			size = "w1280"
		}
		relPath = strings.TrimLeft(relPath, "/")
		localPath := filepath.Join(ImageCacheDir, size, relPath)
		if _, err := os.Stat(localPath); err == nil {
			continue // Já baixado
		}

		remoteUrl := fmt.Sprintf("%s/%s/%s", TmdbImageBase, size, relPath)
		client := http.Client{Timeout: 20 * time.Second}
		req, _ := http.NewRequest("GET", remoteUrl, nil)
		req.Header.Set("User-Agent", "MeuPlayer/1.0")

		resp, err := client.Do(req)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			_ = os.MkdirAll(filepath.Dir(localPath), 0755)
			tmpPath := localPath + ".tmp"
			f, err := os.Create(tmpPath)
			if err == nil {
				_, _ = io.Copy(f, resp.Body)
				f.Close()
				_ = os.Rename(tmpPath, localPath)
			}
		}
	}
}

// TMDB: Genres
func handleTmdbGenres(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	mediaType := r.URL.Query().Get("type")
	tmdbMedia := "movie"
	if mediaType != "movie" {
		tmdbMedia = "tv"
	}
	cacheKey := fmt.Sprintf("genres:%s:pt-BR", tmdbMedia)
	urlStr := fmt.Sprintf("%s/genre/%s/list?api_key=%s&language=pt-BR", TmdbBase, tmdbMedia, getTmdbApiKey())
	fetchWithCache(w, cacheKey, urlStr, TtlTmdbGenresSeconds, nil)
}

// TMDB: Search
func handleTmdbSearch(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	mediaType := q.Get("type")
	term := q.Get("query")
	if term == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro query é obrigatório", "")
		return
	}

	tmdbMedia := "movie"
	if mediaType != "movie" {
		tmdbMedia = "tv"
	}
	cacheKey := fmt.Sprintf("search:%s:%s:pt-BR", tmdbMedia, strings.ToLower(term))
	urlStr := fmt.Sprintf("%s/search/%s?api_key=%s&language=pt-BR&query=%s&include_adult=false&page=1",
		TmdbBase, tmdbMedia, getTmdbApiKey(), url.QueryEscape(term))
	fetchWithCache(w, cacheKey, urlStr, TtlTmdbSearchSeconds, nil)
}

// TMDB: Discover
func handleTmdbDiscover(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	mediaType := q.Get("type")
	genreID := strings.TrimSpace(q.Get("genre"))
	page := q.Get("page")
	if page == "" {
		page = "1"
	}
	originalLanguage := strings.ToLower(strings.TrimSpace(q.Get("original_language")))

	if genreID == "" && originalLanguage == "" {
		sendJSONError(w, http.StatusBadRequest, "Informe genre e/ou original_language", "")
		return
	}

	if originalLanguage != "" {
		matched, _ := regexp.MatchString("^[a-z]{2}$", originalLanguage)
		if !matched {
			sendJSONError(w, http.StatusBadRequest, "Parâmetro original_language inválido", "")
			return
		}
	}

	sortParam := strings.ToLower(strings.TrimSpace(q.Get("sort")))
	tmdbMedia := "movie"
	if mediaType != "movie" {
		tmdbMedia = "tv"
	}

	defaultSort := "first_air_date.desc"
	dateFilter := "&first_air_date.lte=" + time.Now().Format("2006-01-02")
	if tmdbMedia == "movie" {
		defaultSort = "primary_release_date.desc"
		dateFilter = "&primary_release_date.lte=" + time.Now().Format("2006-01-02")
	}

	sortBy := defaultSort
	if sortParam == "popularity" {
		sortBy = "popularity.desc"
	} else if sortParam == "vote" {
		sortBy = "vote_count.desc"
	}

	cacheKey := fmt.Sprintf("discover:%s:%s:%s:pt-BR", tmdbMedia, sortBy, page)
	if genreID != "" {
		cacheKey += ":genre:" + genreID
	}
	if originalLanguage != "" {
		cacheKey += ":lang:" + originalLanguage
	}

	langFilter := ""
	if originalLanguage != "" {
		langFilter = "&with_original_language=" + url.QueryEscape(originalLanguage)
	}

	genreFilter := ""
	if genreID != "" {
		genreFilter = "&with_genres=" + url.QueryEscape(genreID)
	}

	urlStr := fmt.Sprintf("%s/discover/%s?api_key=%s&language=pt-BR%s&include_adult=false&sort_by=%s%s%s&page=%s",
		TmdbBase, tmdbMedia, getTmdbApiKey(), genreFilter, sortBy, dateFilter, langFilter, url.QueryEscape(page))

	fetchWithCache(w, cacheKey, urlStr, TtlTmdbSearchSeconds, nil)
}

// TMDB: Season
func handleTmdbSeason(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	tmdbID := q.Get("id")
	seasonNumber := q.Get("season")
	if tmdbID == "" || seasonNumber == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetros id e season são obrigatórios", "")
		return
	}

	cacheKey := fmt.Sprintf("season:%s:%s:pt-BR", tmdbID, seasonNumber)
	urlStr := fmt.Sprintf("%s/tv/%s/season/%s?api_key=%s&language=pt-BR", TmdbBase, tmdbID, seasonNumber, getTmdbApiKey())
	fetchWithCache(w, cacheKey, urlStr, TtlTmdbSeasonSeconds, nil)
}

// TMDB: Related (Recommendations)
func handleTmdbRelated(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	mediaType := q.Get("type")
	tmdbID := q.Get("id")
	if tmdbID == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro id é obrigatório", "")
		return
	}

	tmdbMedia := "movie"
	if mediaType != "movie" {
		tmdbMedia = "tv"
	}

	cacheKey := fmt.Sprintf("related:%s:%s:pt-BR", tmdbMedia, tmdbID)
	urlStr := fmt.Sprintf("%s/%s/%s/recommendations?api_key=%s&language=pt-BR&page=1", TmdbBase, tmdbMedia, tmdbID, getTmdbApiKey())
	fetchWithCache(w, cacheKey, urlStr, TtlTmdbRelatedSeconds, nil)
}

// TMDB: Credits (Elenco)
func handleTmdbCredits(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	mediaType := q.Get("type")
	tmdbID := q.Get("id")
	if tmdbID == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro id é obrigatório", "")
		return
	}

	tmdbMedia := "movie"
	if mediaType != "movie" {
		tmdbMedia = "tv"
	}

	cacheKey := fmt.Sprintf("credits:%s:%s:pt-BR", tmdbMedia, tmdbID)
	urlStr := fmt.Sprintf("%s/%s/%s/credits?api_key=%s&language=pt-BR", TmdbBase, tmdbMedia, tmdbID, getTmdbApiKey())
	fetchWithCache(w, cacheKey, urlStr, TtlTmdbDetailsSeconds, nil)
}

// TMDB: Person (Detalhes do Ator)
func handleTmdbPerson(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	personID := q.Get("id")
	if personID == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro id é obrigatório", "")
		return
	}

	cacheKey := fmt.Sprintf("person:%s:pt-BR", personID)
	urlStr := fmt.Sprintf("%s/person/%s?api_key=%s&language=pt-BR", TmdbBase, personID, getTmdbApiKey())
	fetchWithCache(w, cacheKey, urlStr, TtlTmdbDetailsSeconds, nil)
}

// TMDB: Person Credits (Filmografia)
func handleTmdbPersonCredits(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	personID := q.Get("id")
	if personID == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro id é obrigatório", "")
		return
	}

	cacheKey := fmt.Sprintf("person_credits:%s:pt-BR", personID)
	urlStr := fmt.Sprintf("%s/person/%s/combined_credits?api_key=%s&language=pt-BR", TmdbBase, personID, getTmdbApiKey())
	fetchWithCache(w, cacheKey, urlStr, TtlTmdbDetailsSeconds, nil)
}

// API: Batch de Metadados de Mídia (ThreadPool equivalente)
func handleMediaMetaBatch(w http.ResponseWriter, r *http.Request) {
	if !ensureTmdbKey(w) {
		return
	}
	q := r.URL.Query()
	mediaType := q.Get("type")
	if mediaType == "" {
		mediaType = "movie"
	}
	rawIDs := q.Get("ids")
	idList := strings.Split(rawIDs, ",")

	var ids []string
	for _, id := range idList {
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}

	if len(ids) == 0 {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro ids é obrigatório", "")
		return
	}

	// Limita para no máximo 80 requisições
	if len(ids) > 80 {
		ids = ids[:80]
	}

	type resultItem struct {
		ID   string
		Meta map[string]interface{}
	}

	tmdbMedia := "movie"
	if mediaType != "movie" {
		tmdbMedia = "tv"
	}

	resChan := make(chan resultItem, len(ids))
	var wg sync.WaitGroup

	// Cria Workers (equivalente a ThreadPoolExecutor com max_workers=6)
	sem := make(chan struct{}, 6)

	for _, tid := range ids {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			storageKey := fmt.Sprintf("%s:%s", tmdbMedia, id)
			var body []byte
			var cacheStatus string

			// Tenta no persistente primeiro
			stored, err := DbCache.MediaMetadataGet(storageKey)
			if err == nil && len(stored) > 0 {
				body = stored
				cacheStatus = "STORE"
			} else {
				// Tenta no cache comum
				cacheKey := fmt.Sprintf("tmdb:%s:%s:pt-BR", tmdbMedia, id)
				status, _, cacheBody, expiresAt, err := DbCache.ApiCacheGet(cacheKey)
				if err == nil && expiresAt > time.Now().Unix() && status == http.StatusOK {
					body = cacheBody
					cacheStatus = "HIT"
					_ = DbCache.MediaMetadataSet(storageKey, tmdbMedia, id, body, time.Now().Unix())
				} else {
					// Busca remota
					urlStr := fmt.Sprintf("%s/%s/%s?api_key=%s&language=pt-BR", TmdbBase, tmdbMedia, id, getTmdbApiKey())
					client := http.Client{Timeout: 10 * time.Second}
					req, _ := http.NewRequest("GET", urlStr, nil)
					req.Header.Set("User-Agent", "MeuPlayer/1.0")

					resp, err := client.Do(req)
					if err == nil && resp.StatusCode == http.StatusOK {
						defer resp.Body.Close()
						if respBody, err := io.ReadAll(resp.Body); err == nil {
							body = respBody
							cacheStatus = "MISS"
							now := time.Now().Unix()
							_ = DbCache.ApiCacheSet(cacheKey, http.StatusOK, "application/json; charset=utf-8", body, now+TtlTmdbDetailsSeconds, now)
							_ = DbCache.MediaMetadataSet(storageKey, tmdbMedia, id, body, now)
						}
					}
				}
			}

			if len(body) > 0 {
				var meta map[string]interface{}
				if err := json.Unmarshal(body, &meta); err == nil {
					if !tmdbMetaIsAdult(meta) {
						meta["_cache"] = cacheStatus
						resChan <- resultItem{ID: id, Meta: meta}
						return
					}
				}
			}
			resChan <- resultItem{ID: id, Meta: nil}
		}(tid)
	}

	wg.Wait()
	close(resChan)

	items := make(map[string]interface{})
	for r := range resChan {
		if r.Meta != nil {
			items[r.ID] = r.Meta
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"items": items})
}

// Filtro de Segurança Adulto
func tmdbMetaIsAdult(meta map[string]interface{}) bool {
	if meta == nil {
		return false
	}
	if adult, ok := meta["adult"].(bool); ok && adult {
		return true
	}

	// Varre campos de texto em busca de termos sensíveis
	checkKeys := []string{"title", "name", "original_title", "original_name", "overview", "tagline"}
	var sb strings.Builder
	for _, key := range checkKeys {
		if val, ok := meta[key].(string); ok {
			sb.WriteString(" ")
			sb.WriteString(val)
		}
	}

	text := normalizeText(sb.String())
	matched, _ := regexp.MatchString(`\b(porn|porno|xxx|erotic|erotico|softcore|hardcore)\b`, text)
	return matched
}

// Normaliza texto removendo acentos e deixando em caixa baixa
func normalizeText(s string) string {
	s = strings.ToLower(s)
	// Mapa básico de transliteração para português (rápido e simples)
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "ô", "o", "õ", "o", "ö", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u",
		"ç", "c",
	)
	return replacer.Replace(s)
}

// API: Listar Mídias Salvas no Cache do Banco
func handleMediaStored(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := 200
	if limitStr := q.Get("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}
	if limit > 500 {
		limit = 500
	}

	rows, err := DbCache.MediaMetadataList(limit)
	if err != nil {
		sendJSONError(w, http.StatusInternalServerError, "Falha ao consultar banco", err.Error())
		return
	}

	var items []map[string]interface{}
	for _, row := range rows {
		var meta map[string]interface{}
		if err := json.Unmarshal(row.Body, &meta); err != nil {
			continue
		}
		if tmdbMetaIsAdult(meta) {
			continue
		}

		appType := "movie"
		if row.MediaType != "movie" {
			appType = "serie"
		}
		if row.MediaType == "tv" && isAnimationTV(meta) {
			appType = "anime"
		}

		items = append(items, map[string]interface{}{
			"id":         row.TmdbID,
			"type":       appType,
			"media_key":  row.MediaKey,
			"updated_at": row.UpdatedAt,
			"meta":       meta,
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"items": items})
}

func isAnimationTV(meta map[string]interface{}) bool {
	if meta == nil {
		return false
	}
	// Verifica nos IDs de gêneros
	if genres, ok := meta["genres"].([]interface{}); ok {
		for _, g := range genres {
			if gm, ok := g.(map[string]interface{}); ok {
				if id, ok := gm["id"].(float64); ok && int(id) == AnimationGenreID {
					return true
				}
			} else if id, ok := g.(float64); ok && int(id) == AnimationGenreID {
				return true
			}
		}
	}
	if genreIDs, ok := meta["genre_ids"].([]interface{}); ok {
		for _, g := range genreIDs {
			if id, ok := g.(float64); ok && int(id) == AnimationGenreID {
				return true
			}
		}
	}
	return false
}

// Proxy de Imagens do TMDB (Cria pastas e salva localmente)
func handleTmdbImage(w http.ResponseWriter, r *http.Request) {
	prefix := "/api/image/tmdb/"
	raw := r.URL.Path[len(prefix):]
	parts := strings.SplitN(raw, "/", 2)
	if len(parts) < 2 {
		sendJSONError(w, http.StatusBadRequest, "Formato inválido de imagem", "")
		return
	}
	size := parts[0]
	imageRelPath := parts[1]

	if !allowedImageSizes[size] {
		sendJSONError(w, http.StatusBadRequest, "Tamanho de imagem inválido", "")
		return
	}

	// Sanitização contra path traversal
	if strings.Contains(imageRelPath, "..") || strings.HasPrefix(imageRelPath, ".") || strings.Contains(imageRelPath, "\\") {
		sendJSONError(w, http.StatusBadRequest, "Caminho de imagem inválido", "")
		return
	}

	ext := strings.ToLower(filepath.Ext(imageRelPath))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		sendJSONError(w, http.StatusBadRequest, "Formato de arquivo não suportado", "")
		return
	}

	localPath := filepath.Join(ImageCacheDir, size, imageRelPath)

	serveLocalImage := func(status string) {
		w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", TtlImageSeconds))
		w.Header().Set("X-Cache", status)
		http.ServeFile(w, r, localPath)
	}

	// 1. Tenta servir localmente
	if fi, err := os.Stat(localPath); err == nil {
		if time.Now().Unix()-fi.ModTime().Unix() <= TtlImageSeconds {
			serveLocalImage("HIT")
			return
		}
	}

	// 2. Tenta download remoto
	remoteUrl := fmt.Sprintf("%s/%s/%s", TmdbImageBase, size, imageRelPath)
	client := http.Client{Timeout: 20 * time.Second}
	req, _ := http.NewRequest("GET", remoteUrl, nil)
	req.Header.Set("User-Agent", "MeuPlayer/1.0")

	resp, err := client.Do(req)
	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		_ = os.MkdirAll(filepath.Dir(localPath), 0755)
		tmpPath := localPath + ".tmp"
		f, err := os.Create(tmpPath)
		if err == nil {
			_, _ = io.Copy(f, resp.Body)
			f.Close()
			_ = os.Rename(tmpPath, localPath)
			serveLocalImage("MISS")
			return
		}
	}

	// Fallback para arquivo local já existente (mesmo que antigo)
	if _, err := os.Stat(localPath); err == nil {
		serveLocalImage("STALE")
		return
	}

	// Fallback final: 1x1 GIF
	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("X-Cache", "PLACEHOLDER")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(placeholderGif)
}

// Parseador nativo do Guia de Programação (HTML -> JSON)
