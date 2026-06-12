package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
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

// Configurações e Constantes
var (
	BaseDir      string
	UserDataDir  string
	StaticDir    string
	ImageCacheDir string
	DbCache      *CacheDB
	TmdbApiKey   string
	TmdbKeyLock  sync.RWMutex
)

const (
	Port                   = "3000"
	ApiBase                = "https://superflixapi.one"
	RdeApiBase             = "https://reidosembeds.com/api"
	RdeAdultCategory       = "adulto"
	TmdbBase               = "https://api.themoviedb.org/3"
	TmdbImageBase          = "https://image.tmdb.org/t/p"
	AnimationGenreID       = 16
	TtlGuiaSeconds         = 30 * 60
	TtlTmdbDetailsSeconds  = 7 * 24 * 60 * 60
	TtlTmdbGenresSeconds   = 30 * 24 * 60 * 60
	TtlTmdbSearchSeconds   = 24 * 60 * 60
	TtlTmdbSeasonSeconds   = 3 * 24 * 60 * 60
	TtlTmdbRelatedSeconds  = 3 * 24 * 60 * 60
	TtlImageSeconds        = 30 * 24 * 60 * 60
	TtlListaSeconds        = 6 * 60 * 60
	TtlRdeSeconds          = 30 * 60
	RemoteSessionTtl       = 4 * 60 * 60
)

// Allowed Image Sizes
var allowedImageSizes = map[string]bool{
	"w45": true, "w92": true, "w154": true, "w185": true,
	"w300": true, "w342": true, "w500": true, "w780": true,
	"w1280": true, "original": true,
}

// 1x1 GIF transparente
var placeholderGif = []byte{
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
	0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
	0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
	0x00, 0x02, 0x01, 0x44, 0x00, 0x3b,
}

// Estruturas do Controle Remoto
type RemoteSession struct {
	CreatedAt int64
	Clients   map[chan string]bool
	Lock      sync.Mutex
}

var (
	sessions     = make(map[string]*RemoteSession)
	sessionsLock sync.Mutex
)

func main() {
	setupPaths()
	loadEnvFile()
	bootstrapTmdbKey()
	setupDatabase()

	// Inicia limpeza periódica do cache
	go runPeriodicCleanup()

	// Servidor HTTP
	mux := http.NewServeMux()

	// API e Proxies
	mux.HandleFunc("/api/settings", handleSettings)
	mux.HandleFunc("/api/lista", handleLista)
	mux.HandleFunc("/api/calendario", handleCalendario)
	mux.HandleFunc("/api/tmdb", handleTmdbDetail)
	mux.HandleFunc("/api/tmdb/genres", handleTmdbGenres)
	mux.HandleFunc("/api/tmdb/search", handleTmdbSearch)
	mux.HandleFunc("/api/tmdb/discover", handleTmdbDiscover)
	mux.HandleFunc("/api/tmdb/season", handleTmdbSeason)
	mux.HandleFunc("/api/tmdb/related", handleTmdbRelated)
	mux.HandleFunc("/api/tmdb/credits", handleTmdbCredits)
	mux.HandleFunc("/api/tmdb/person", handleTmdbPerson)
	mux.HandleFunc("/api/tmdb/person/credits", handleTmdbPersonCredits)
	mux.HandleFunc("/api/image/tmdb/", handleTmdbImage)
	mux.HandleFunc("/api/guia", handleGuia)
	mux.HandleFunc("/api/media/meta/batch", handleMediaMetaBatch)
	mux.HandleFunc("/api/media/stored", handleMediaStored)
	mux.HandleFunc("/api/rede-buzz/channels", handleRedeBuzzChannels)
	mux.HandleFunc("/api/rede-buzz/categories", handleRedeBuzzCategories)
	mux.HandleFunc("/api/rede-buzz/search", handleRedeBuzzSearch)

	// Controle Remoto
	mux.HandleFunc("/api/remote/session", handleRemoteSessionCreate)
	mux.HandleFunc("/api/remote/events", handleRemoteEvents)
	mux.HandleFunc("/api/remote/command", handleRemoteCommand)

	// Utilitários para multi-dispositivo e cache
	mux.HandleFunc("/api/client-env", handleClientEnv)
	mux.HandleFunc("/api/channels/unified", handleUnifiedChannels)
	mux.HandleFunc("/api/cache/stats", handleCacheStats)
	mux.HandleFunc("/api/cache/clear", handleCacheClear)

	// Páginas Estáticas e SPA fallback
	mux.HandleFunc("/", handleStaticOrSPA)

	port := os.Getenv("PORT")
	if port == "" {
		port = Port
	}

	fmt.Printf("[meuplayer] Servidor iniciado em http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(mux)))
}

// Middleware CORS
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Configuração de Caminhos
func setupPaths() {
	var err error
	BaseDir, err = filepath.Abs(filepath.Dir(os.Args[0]))
	if err != nil {
		BaseDir = "."
	}

	UserDataDir = os.Getenv("MEUPLAYER_USER_DATA")
	if UserDataDir == "" {
		UserDataDir = BaseDir
	}

	StaticDir = os.Getenv("MEUPLAYER_STATIC_DIR")
	if StaticDir == "" {
		StaticDir = filepath.Join(BaseDir, "public")
	}

	ImageCacheDir = filepath.Join(StaticDir, "cache", "images", "tmdb")
	_ = os.MkdirAll(UserDataDir, 0755)
	_ = os.MkdirAll(ImageCacheDir, 0755)
}

// Carregar arquivo .env se existir
func loadEnvFile() {
	envPath := filepath.Join(BaseDir, ".env")
	if _, err := os.Stat(envPath); err != nil {
		return
	}
	content, err := os.ReadFile(envPath)
	if err != nil {
		return
	}
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

// Carrega a chave do TMDB
func bootstrapTmdbKey() {
	// Primeiro, lê do settings.json
	settingsPath := filepath.Join(UserDataDir, "settings.json")
	if _, err := os.Stat(settingsPath); err == nil {
		if content, err := os.ReadFile(settingsPath); err == nil {
			var settings map[string]interface{}
			if err := json.Unmarshal(content, &settings); err == nil {
				if key, ok := settings["tmdbApiKey"].(string); ok && strings.TrimSpace(key) != "" {
					setTmdbApiKey(key)
					return
				}
			}
		}
	}

	// Segundo, lê das variáveis de ambiente
	key := os.Getenv("TMDB_API_KEY")
	if strings.TrimSpace(key) != "" {
		setTmdbApiKey(key)
	}
}

func getTmdbApiKey() string {
	TmdbKeyLock.RLock()
	defer TmdbKeyLock.RUnlock()
	return TmdbApiKey
}

func setTmdbApiKey(key string) {
	TmdbKeyLock.Lock()
	defer TmdbKeyLock.Unlock()
	TmdbApiKey = strings.TrimSpace(key)
}

func maskTmdbKey(key string) string {
	if len(key) <= 8 {
		if key != "" {
			return "••••"
		}
		return ""
	}
	return key[:4] + "…" + key[len(key)-4:]
}

// Configura o Banco de Dados de Cache
func setupDatabase() {
	dbUrl := os.Getenv("CACHE_DATABASE_URL")
	var driver, dsn string

	if dbUrl != "" && (strings.HasPrefix(dbUrl, "postgres://") || strings.HasPrefix(dbUrl, "postgresql://")) {
		driver = "postgres"
		dsn = dbUrl
	} else {
		driver = "sqlite"
		dsn = filepath.Join(UserDataDir, "cache.sqlite3")
	}

	var err error
	DbCache, err = NewCacheDB(driver, dsn)
	if err != nil {
		log.Fatalf("[meuplayer] Erro ao inicializar banco de cache: %v", err)
	}
	fmt.Printf("[meuplayer] cache: %s\n", DbCache.driver)
}

// Limpeza Periódica de Cache Expirado
func runPeriodicCleanup() {
	ticker := time.NewTicker(12 * time.Hour)
	for range ticker.C {
		now := time.Now().Unix()
		// Deleta cache de API expirado
		_, _ = DbCache.db.Exec(DbCache.query("DELETE FROM api_cache WHERE expires_at <= ?"), now)
	}
}

// Helper para enviar erros JSON
func sendJSONError(w http.ResponseWriter, status int, errStr, detail string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	resp := map[string]string{"error": errStr}
	if detail != "" {
		resp["detail"] = detail
	}
	_ = json.NewEncoder(w).Encode(resp)
}

// Helper para verificar chave TMDB
func ensureTmdbKey(w http.ResponseWriter) bool {
	if getTmdbApiKey() != "" {
		return true
	}
	sendJSONError(w, http.StatusBadRequest, "TMDB_API_KEY não configurada", "Abra Configurações no menu e informe sua chave do TMDB")
	return false
}

// Roteamento SPA e arquivos estáticos
func handleStaticOrSPA(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Resolve rotas amigáveis da SPA
	target := ""
	if path == "/" || path == "" {
		target = "index.html"
	} else if path == "/canais" || path == "/canais/" {
		target = "canais.html"
	} else if path == "/rede-buzz" || path == "/rede-buzz/" {
		target = "rede-buzz.html"
	} else if path == "/rede-buzz-favoritos" || path == "/rede-buzz-favoritos/" {
		target = "rede-buzz-favoritos.html"
	} else if path == "/configuracoes" || path == "/configuracoes/" {
		target = "configuracoes.html"
	} else if path == "/remote" || path == "/remote/" {
		target = "remote.html"
	} else if path == "/downloads" || path == "/downloads/" {
		target = "downloads.html"
	} else {
		routeMap := []string{"/filme", "/anime", "/serie", "/dorama"}
		for _, prefix := range routeMap {
			if path == prefix || path == prefix+"/" || strings.HasPrefix(path, prefix+"/") {
				target = prefix[1:] + ".html"
				break
			}
		}
	}

	if target != "" {
		http.ServeFile(w, r, filepath.Join(StaticDir, target))
		return
	}

	// Caso contrário, serve o arquivo estático diretamente
	http.FileServer(http.Dir(StaticDir)).ServeHTTP(w, r)
}

// API: Configurações
func handleSettings(w http.ResponseWriter, r *http.Request) {
	settingsPath := filepath.Join(UserDataDir, "settings.json")

	if r.Method == "GET" {
		key := getTmdbApiKey()
		resp := map[string]interface{}{
			"hasTmdbKey":     key != "",
			"tmdbKeyPreview": maskTmdbKey(key),
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	if r.Method == "POST" {
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			sendJSONError(w, http.StatusBadRequest, "JSON inválido", err.Error())
			return
		}

		key, exists := body["tmdbApiKey"]
		if exists {
			key = strings.TrimSpace(key)
			setTmdbApiKey(key)

			// Salva em settings.json
			settings := make(map[string]interface{})
			if content, err := os.ReadFile(settingsPath); err == nil {
				_ = json.Unmarshal(content, &settings)
			}
			if key != "" {
				settings["tmdbApiKey"] = key
			} else {
				delete(settings, "tmdbApiKey")
			}

			data, _ := json.MarshalIndent(settings, "", "  ")
			_ = os.WriteFile(settingsPath, append(data, '\n'), 0644)
		}

		respKey := getTmdbApiKey()
		resp := map[string]interface{}{
			"ok":             true,
			"hasTmdbKey":     respKey != "",
			"tmdbKeyPreview": maskTmdbKey(respKey),
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
}

// Cache da API Proxy Helper
func fetchWithCache(w http.ResponseWriter, cacheKey string, urlStr string, ttlSeconds int64, cleanBodyFunc func([]byte) []byte) {
	// 1. Tenta recuperar do cache
	status, contentType, body, expiresAt, err := DbCache.ApiCacheGet(cacheKey)
	if err == nil && expiresAt > time.Now().Unix() {
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(status)
		_, _ = w.Write(body)
		return
	}

	// 2. Tenta acessar a URL externa
	client := http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", urlStr, nil)
	req.Header.Set("User-Agent", "MeuPlayer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		sendJSONError(w, http.StatusBadGateway, "Falha ao acessar API externa", err.Error())
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		sendJSONError(w, http.StatusBadGateway, "Falha ao ler resposta da API externa", err.Error())
		return
	}

	if cleanBodyFunc != nil && resp.StatusCode == http.StatusOK {
		respBody = cleanBodyFunc(respBody)
	}

	// Salva no cache se status for 200
	if resp.StatusCode == http.StatusOK {
		contentType := resp.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/json"
		}
		now := time.Now().Unix()
		_ = DbCache.ApiCacheSet(cacheKey, resp.StatusCode, contentType, respBody, now+ttlSeconds, now)
	}

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(respBody)
}

// API: Lista
func handleLista(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if q.Get("format") == "" {
		q.Set("format", "json")
	}
	rawQuery := q.Encode()
	cacheKey := fmt.Sprintf("lista:%s", rawQuery)
	urlStr := fmt.Sprintf("%s/lista?%s", ApiBase, rawQuery)
	fetchWithCache(w, cacheKey, urlStr, TtlListaSeconds, nil)
}

// API: Calendário
func handleCalendario(w http.ResponseWriter, r *http.Request) {
	urlStr := fmt.Sprintf("%s/calendario.php", ApiBase)
	client := http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", urlStr, nil)
	req.Header.Set("User-Agent", "MeuPlayer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		sendJSONError(w, http.StatusBadGateway, "Falha ao acessar API externa", err.Error())
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// API: Detalhes do TMDB (com cache duplo no banco e pré-download de imagens)
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
func parseGuiaHTML(htmlBytes []byte) []map[string]string {
	html := string(htmlBytes)
	// Encontra horários em formato de guia
	timeRe := regexp.MustCompile(`\b\d{1,2}:\d{2}\b`)

	// Remoção simples de tags complexas (equivalente a pular head/style/script)
	reStyle := regexp.MustCompile(`(?s)<style.*?>.*?</style>`)
	reScript := regexp.MustCompile(`(?s)<script.*?>.*?</script>`)
	reHead := regexp.MustCompile(`(?s)<head.*?>.*?</head>`)
	html = reStyle.ReplaceAllString(html, "")
	html = reScript.ReplaceAllString(html, "")
	html = reHead.ReplaceAllString(html, "")

	// Remove tags HTML substituindo por quebra de linha
	reTags := regexp.MustCompile(`<.*?>`)
	plainText := reTags.ReplaceAllString(html, "\n")

	lines := strings.Split(plainText, "\n")
	var chunks []string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l != "" {
			chunks = append(chunks, l)
		}
	}

	var schedule []map[string]string
	i := 0
	for i < len(chunks) {
		if timeRe.MatchString(chunks[i]) {
			entry := map[string]string{
				"time":  chunks[i],
				"title": "",
				"genre": "",
			}
			j := i + 1
			if j < len(chunks) && !timeRe.MatchString(chunks[j]) {
				entry["title"] = chunks[j]
				j++
				if j < len(chunks) && strings.Contains(chunks[j], "/") && !timeRe.MatchString(chunks[j]) {
					entry["genre"] = chunks[j]
					j++
				}
			}
			if entry["title"] != "" {
				schedule = append(schedule, entry)
			}
			i = j
		} else {
			i++
		}
	}
	return schedule
}

// API: Guia de Programação de TV
func handleGuia(w http.ResponseWriter, r *http.Request) {
	canal := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("canal")))
	if canal == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro canal inválido ou ausente", "")
		return
	}
	matched, _ := regexp.MatchString("^[A-Z0-9]{1,10}$", canal)
	if !matched {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro canal inválido", "")
		return
	}

	today := time.Now().Format("2006-01-02")
	cacheKey := fmt.Sprintf("guia:%s:%s", canal, today)

	// Tenta do cache
	status, contentType, body, expiresAt, err := DbCache.ApiCacheGet(cacheKey)
	if err == nil && expiresAt > time.Now().Unix() {
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(status)
		_, _ = w.Write(body)
		return
	}

	urlStr := fmt.Sprintf("https://meuguia.tv/programacao/canal/%s", canal)
	client := http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", urlStr, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9")

	resp, err := client.Do(req)
	if err != nil {
		sendJSONError(w, http.StatusBadGateway, "Falha ao acessar o guia", err.Error())
		return
	}
	defer resp.Body.Close()

	htmlBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		sendJSONError(w, http.StatusBadGateway, "Falha ao ler o guia", err.Error())
		return
	}

	schedule := parseGuiaHTML(htmlBytes)
	respBody, _ := json.Marshal(schedule)

	now := time.Now().Unix()
	_ = DbCache.ApiCacheSet(cacheKey, http.StatusOK, "application/json; charset=utf-8", respBody, now+TtlGuiaSeconds, now)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(respBody)
}

// Filtros da Rede Buzz (Rei dos Embeds)
func filterRedeBuzzPayload(data []byte) []byte {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return data
	}

	items, ok := payload["data"]
	if !ok {
		return data
	}

	// Se for uma lista (canais ou categorias)
	if arr, ok := items.([]interface{}); ok {
		var filtered []interface{}
		for _, item := range arr {
			if m, ok := item.(map[string]interface{}); ok {
				// Verifica se é categoria adulta
				if isRdeAdultCategory(m["id"]) || isRdeAdultCategory(m["name"]) || isRdeAdultCategory(m["category"]) || isRdeAdultCategory(m["category_id"]) || isRdeAdultCategory(m["categoryId"]) {
					continue
				}
				filtered = append(filtered, m)
			} else {
				filtered = append(filtered, item)
			}
		}
		payload["data"] = filtered
		if _, ok := payload["total"]; ok {
			payload["total"] = len(filtered)
		}
	} else if m, ok := items.(map[string]interface{}); ok {
		// Se for um único canal contendo um objeto
		if isRdeAdultCategory(m["category"]) || isRdeAdultCategory(m["category_id"]) || isRdeAdultCategory(m["categoryId"]) {
			payload["data"] = nil
		} else if channels, ok := m["channels"].([]interface{}); ok {
			var filtered []interface{}
			for _, ch := range channels {
				if cm, ok := ch.(map[string]interface{}); ok {
					if isRdeAdultCategory(cm["category"]) || isRdeAdultCategory(cm["category_id"]) || isRdeAdultCategory(cm["categoryId"]) {
						continue
					}
					filtered = append(filtered, cm)
				}
			}
			m["channels"] = filtered
			payload["data"] = m
		}
	}

	res, err := json.Marshal(payload)
	if err != nil {
		return data
	}
	return res
}

func isRdeAdultCategory(val interface{}) bool {
	if val == nil {
		return false
	}
	s := strings.ToLower(strings.TrimSpace(fmt.Sprintf("%v", val)))
	return s == RdeAdultCategory
}

// API: Canais da Rede Buzz
func handleRedeBuzzChannels(w http.ResponseWriter, r *http.Request) {
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	if isRdeAdultCategory(category) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write([]byte(`{"success":true,"data":[],"total":0}`))
		return
	}

	var urlStr, cacheKey string
	if category != "" {
		urlStr = fmt.Sprintf("%s/channels?category=%s", RdeApiBase, url.QueryEscape(category))
		cacheKey = fmt.Sprintf("rde:channels:cat:%s", strings.ToLower(category))
	} else {
		urlStr = fmt.Sprintf("%s/channels", RdeApiBase)
		cacheKey = "rde:channels:all"
	}

	fetchWithCache(w, cacheKey, urlStr, TtlRdeSeconds, filterRedeBuzzPayload)
}

// API: Categorias da Rede Buzz
func handleRedeBuzzCategories(w http.ResponseWriter, r *http.Request) {
	urlStr := fmt.Sprintf("%s/channels/categories", RdeApiBase)
	fetchWithCache(w, "rde:categories", urlStr, TtlRdeSeconds, filterRedeBuzzPayload)
}

// API: Pesquisa da Rede Buzz
func handleRedeBuzzSearch(w http.ResponseWriter, r *http.Request) {
	term := strings.TrimSpace(r.URL.Query().Get("q"))
	if term == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro q é obrigatório", "")
		return
	}
	urlStr := fmt.Sprintf("%s/pesquisa?q=%s", RdeApiBase, url.QueryEscape(term))
	cacheKey := fmt.Sprintf("rde:search:%s", strings.ToLower(term))
	fetchWithCache(w, cacheKey, urlStr, TtlRdeSeconds, filterRedeBuzzPayload)
}

// REMOTE CONTROL: Criar Sessão
func handleRemoteSessionCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	token := generateSessionToken()
	sessionsLock.Lock()
	sessions[token] = &RemoteSession{
		CreatedAt: time.Now().Unix(),
		Clients:   make(map[chan string]bool),
	}
	sessionsLock.Unlock()

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"token": token})
}

// REMOTE CONTROL: Stream SSE (Server-Sent Events)
func handleRemoteEvents(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("session"))
	sessionsLock.Lock()
	session, exists := sessions[token]
	sessionsLock.Unlock()

	if !exists || time.Now().Unix()-session.CreatedAt >= RemoteSessionTtl {
		sendJSONError(w, http.StatusNotFound, "Sessão não encontrada ou expirada", "")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming sem suporte", http.StatusInternalServerError)
		return
	}

	// Registra o cliente na sessão
	clientChan := make(chan string, 10)
	session.Lock.Lock()
	session.Clients[clientChan] = true
	session.Lock.Unlock()

	defer func() {
		session.Lock.Lock()
		delete(session.Clients, clientChan)
		close(clientChan)
		session.Lock.Unlock()
	}()

	// Ping inicial / Keep alive
	_, _ = fmt.Fprint(w, ": ping\n\n")
	flusher.Flush()

	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, open := <-clientChan:
			if !open {
				return
			}
			_, err := fmt.Fprintf(w, "data: %s\n\n", msg)
			if err != nil {
				return
			}
			flusher.Flush()

		case <-ticker.C:
			_, err := fmt.Fprint(w, ": ping\n\n")
			if err != nil {
				return
			}
			flusher.Flush()

		case <-r.Context().Done():
			return
		}
	}
}

// REMOTE CONTROL: Receber Comandos
func handleRemoteCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sendJSONError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	token := strings.TrimSpace(body["session"])
	action := strings.TrimSpace(body["action"])
	value := strings.TrimSpace(body["value"])

	if token == "" || action == "" {
		sendJSONError(w, http.StatusBadRequest, "session e action são obrigatórios", "")
		return
	}

	sessionsLock.Lock()
	session, exists := sessions[token]
	sessionsLock.Unlock()

	if !exists || time.Now().Unix()-session.CreatedAt >= RemoteSessionTtl {
		sendJSONError(w, http.StatusNotFound, "Sessão não encontrada ou expirada", "")
		return
	}

	msgMap := map[string]string{"action": action, "value": value}
	msgBytes, _ := json.Marshal(msgMap)
	msgStr := string(msgBytes)

	// Envia a mensagem a todos os clientes conectados a esta sessão (normalmente a janela principal do Electron)
	session.Lock.Lock()
	for clientChan := range session.Clients {
		select {
		case clientChan <- msgStr:
		default:
			// Buffer cheio, ignora ou remove cliente lento
		}
	}
	session.Lock.Unlock()

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true}`))
}

// Utils
func generateSessionToken() string {
	b := make([]byte, 20)
	_, _ = rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// API: Informações de ambiente para o cliente (usado para detecção)
func handleClientEnv(w http.ResponseWriter, r *http.Request) {
	key := getTmdbApiKey()
	resp := map[string]interface{}{
		"isElectron":   false,
		"hasTmdbKey":   key != "",
		"tmdbKeyPreview": maskTmdbKey(key),
		"serverVersion": "go",
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(resp)
}

// API: Canais unificados (locais de canais.json + Rede Buzz RDE) - Sprint 4
func handleUnifiedChannels(w http.ResponseWriter, r *http.Request) {
	// Carrega canais locais
	localPath := filepath.Join(StaticDir, "canais.json")
	localChannels := []map[string]interface{}{}
	if data, err := os.ReadFile(localPath); err == nil {
		var parsed []map[string]interface{}
		if json.Unmarshal(data, &parsed) == nil {
			for _, c := range parsed {
				if isRdeAdultCategory(c["category"]) {
					continue
				}
				localChannels = append(localChannels, map[string]interface{}{
					"id":       c["id"],
					"nome":     c["nome"],
					"src":      c["src"],
					"category": c["category"],
					"source":   "local",
				})
			}
		}
	}

	// Busca RDE (reutiliza lógica de cache)
	// Para simplicidade, chamamos a lógica existente via HTTP interno ou duplicamos fetch simples.
	// Aqui fazemos fetch direto e filtramos.
	rdeURL := fmt.Sprintf("%s/channels", RdeApiBase)
	resp, err := http.Get(rdeURL)
	rdeChannels := []map[string]interface{}{}
	if err == nil {
		defer resp.Body.Close()
		var payload struct {
			Success bool `json:"success"`
			Data    []map[string]interface{} `json:"data"`
		}
		if json.NewDecoder(resp.Body).Decode(&payload) == nil && payload.Success {
			for _, item := range payload.Data {
				if isRdeAdultCategory(item["category"]) || isRdeAdultCategory(item["category_id"]) {
					continue
				}
				id := fmt.Sprintf("%v", item["id"])
				if id == "" {
					continue
				}
				rdeChannels = append(rdeChannels, map[string]interface{}{
					"id":       id,
					"nome":     item["name"],
					"src":      fmt.Sprintf("https://rde.buzz/%s", id),
					"category": item["category"],
					"source":   "rde",
				})
			}
		}
	}

	// Combina: primeiro locais, depois RDE (sem duplicatas por id)
	seen := map[string]bool{}
	combined := []map[string]interface{}{}
	for _, c := range localChannels {
		k := fmt.Sprintf("%v", c["id"])
		if !seen[k] {
			seen[k] = true
			combined = append(combined, c)
		}
	}
	for _, c := range rdeChannels {
		k := fmt.Sprintf("%v", c["id"])
		if !seen[k] {
			seen[k] = true
			combined = append(combined, c)
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    combined,
		"total":   len(combined),
	})
}

// API: Stats do cache (Sprint 5)
func handleCacheStats(w http.ResponseWriter, r *http.Request) {
	if DbCache == nil {
		sendJSONError(w, http.StatusInternalServerError, "Cache não inicializado", "")
		return
	}

	stats := map[string]interface{}{
		"driver": DbCache.driver,
	}

	// Contagens simples
	var apiCount, metaCount int
	_ = DbCache.db.QueryRow(DbCache.query("SELECT COUNT(*) FROM api_cache")).Scan(&apiCount)
	_ = DbCache.db.QueryRow(DbCache.query("SELECT COUNT(*) FROM media_metadata")).Scan(&metaCount)

	stats["api_cache_count"] = apiCount
	stats["media_metadata_count"] = metaCount

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(stats)
}

// API: Limpar cache expirado ou tudo (Sprint 5) - simples para uso pessoal
func handleCacheClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodAllowed)
		return
	}
	if DbCache == nil {
		sendJSONError(w, http.StatusInternalServerError, "Cache não inicializado", "")
		return
	}

	// Limpa apenas expirados por padrão, ou tudo se ?all=1
	all := r.URL.Query().Get("all") == "1"
	now := time.Now().Unix()

	var err error
	if all {
		_, err = DbCache.db.Exec(DbCache.query("DELETE FROM api_cache"))
		_, _ = DbCache.db.Exec(DbCache.query("DELETE FROM media_metadata"))
	} else {
		_, err = DbCache.db.Exec(DbCache.query("DELETE FROM api_cache WHERE expires_at <= ?"), now)
	}

	if err != nil {
		sendJSONError(w, http.StatusInternalServerError, "Falha ao limpar cache", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"ok": "true", "cleared": "expired"})
}
