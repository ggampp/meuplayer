package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"meuplayer/internal/server"
)

// HandleLista repassa a lista do SuperFlix usando o cache de API.
func HandleLista(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if q.Get("format") == "" {
		q.Set("format", "json")
	}
	rawQuery := q.Encode()
	cacheKey := fmt.Sprintf("lista:%s", rawQuery)
	urlStr := fmt.Sprintf("%s/lista?%s", server.ApiBase, rawQuery)
	server.FetchWithCache(w, cacheKey, urlStr, server.TtlListaSeconds, nil)
}

// HandleCalendario repassa o calendário do SuperFlix.
func HandleCalendario(w http.ResponseWriter, r *http.Request) {
	urlStr := fmt.Sprintf("%s/calendario.php", server.ApiBase)
	client := http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", urlStr, nil)
	req.Header.Set("User-Agent", "MeuPlayer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		server.SendJSONError(w, http.StatusBadGateway, "Falha ao acessar API externa", err.Error())
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// HandleGuia retorna a programação de TV de um canal (HTML -> JSON, com cache).
func HandleGuia(w http.ResponseWriter, r *http.Request) {
	canal := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("canal")))
	if canal == "" {
		server.SendJSONError(w, http.StatusBadRequest, "Parâmetro canal inválido ou ausente", "")
		return
	}
	matched, _ := regexp.MatchString("^[A-Z0-9]{1,10}$", canal)
	if !matched {
		server.SendJSONError(w, http.StatusBadRequest, "Parâmetro canal inválido", "")
		return
	}

	today := time.Now().Format("2006-01-02")
	cacheKey := fmt.Sprintf("guia:%s:%s", canal, today)

	// Tenta do cache
	status, contentType, body, expiresAt, err := server.DbCache.ApiCacheGet(cacheKey)
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
		server.SendJSONError(w, http.StatusBadGateway, "Falha ao acessar o guia", err.Error())
		return
	}
	defer resp.Body.Close()

	htmlBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		server.SendJSONError(w, http.StatusBadGateway, "Falha ao ler o guia", err.Error())
		return
	}

	schedule := parseGuiaHTML(htmlBytes)
	respBody, _ := json.Marshal(schedule)

	now := time.Now().Unix()
	_ = server.DbCache.ApiCacheSet(cacheKey, http.StatusOK, "application/json; charset=utf-8", respBody, now+server.TtlGuiaSeconds, now)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(respBody)
}

// parseGuiaHTML extrai a grade de programação do HTML do meuguia.tv.
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
