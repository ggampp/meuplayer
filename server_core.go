package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

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
