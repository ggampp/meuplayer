package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"meuplayer/internal/cache"
)

// Configurações e Constantes
var (
	BaseDir       string
	UserDataDir   string
	StaticDir     string
	ImageCacheDir string
	DbCache       *cache.CacheDB

	tmdbApiKey  string
	tmdbKeyLock sync.RWMutex
)

const (
	Port                  = "3000"
	ApiBase               = "https://superflixapi.one"
	RdeApiBase            = "https://reidosembeds.com/api"
	RdeAdultCategory      = "adulto"
	TmdbBase              = "https://api.themoviedb.org/3"
	TmdbImageBase         = "https://image.tmdb.org/t/p"
	AnimationGenreID      = 16
	TtlGuiaSeconds        = 30 * 60
	TtlTmdbDetailsSeconds = 7 * 24 * 60 * 60
	TtlTmdbGenresSeconds  = 30 * 24 * 60 * 60
	TtlTmdbSearchSeconds  = 24 * 60 * 60
	TtlTmdbSeasonSeconds  = 3 * 24 * 60 * 60
	TtlTmdbRelatedSeconds = 3 * 24 * 60 * 60
	TtlImageSeconds       = 30 * 24 * 60 * 60
	TtlListaSeconds       = 6 * 60 * 60
	TtlRdeSeconds         = 30 * 60
	RemoteSessionTtl      = 4 * 60 * 60
)

// CorsMiddleware aplica os cabeçalhos CORS a todas as respostas.
func CorsMiddleware(next http.Handler) http.Handler {
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

// resolveBaseDir encontra a raiz do projeto (.env / go.mod) em dev e em binário compilado.
func resolveBaseDir() string {
	if dir := strings.TrimSpace(os.Getenv("MEUPLAYER_BASE_DIR")); dir != "" {
		if abs, err := filepath.Abs(dir); err == nil {
			return abs
		}
		return dir
	}

	markers := []string{".env", "go.mod"}
	tryDir := func(dir string) (string, bool) {
		abs, err := filepath.Abs(dir)
		if err != nil {
			return "", false
		}
		for _, marker := range markers {
			if _, err := os.Stat(filepath.Join(abs, marker)); err == nil {
				return abs, true
			}
		}
		return "", false
	}

	if cwd, err := os.Getwd(); err == nil {
		if dir, ok := tryDir(cwd); ok {
			return dir
		}
	}

	if execPath, err := os.Executable(); err == nil {
		if dir, ok := tryDir(filepath.Dir(execPath)); ok {
			return dir
		}
	}

	if dir, ok := tryDir(filepath.Dir(os.Args[0])); ok {
		return dir
	}

	if cwd, err := os.Getwd(); err == nil {
		return cwd
	}
	return "."
}

// SetupPaths configura os caminhos base, de dados e estáticos.
func SetupPaths() {
	BaseDir = resolveBaseDir()

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

// LoadEnvFile carrega o arquivo .env se existir.
func LoadEnvFile() {
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

// BootstrapTmdbKey carrega a chave do TMDB de settings.json ou do ambiente.
func BootstrapTmdbKey() {
	// Primeiro, lê do settings.json
	settingsPath := filepath.Join(UserDataDir, "settings.json")
	if _, err := os.Stat(settingsPath); err == nil {
		if content, err := os.ReadFile(settingsPath); err == nil {
			var settings map[string]interface{}
			if err := json.Unmarshal(content, &settings); err == nil {
				if key, ok := settings["tmdbApiKey"].(string); ok && strings.TrimSpace(key) != "" {
					SetTmdbApiKey(key)
					return
				}
			}
		}
	}

	// Segundo, lê das variáveis de ambiente
	key := os.Getenv("TMDB_API_KEY")
	if strings.TrimSpace(key) != "" {
		SetTmdbApiKey(key)
	}
}

// GetTmdbApiKey retorna a chave TMDB atual.
func GetTmdbApiKey() string {
	tmdbKeyLock.RLock()
	defer tmdbKeyLock.RUnlock()
	return tmdbApiKey
}

// SetTmdbApiKey define a chave TMDB atual.
func SetTmdbApiKey(key string) {
	tmdbKeyLock.Lock()
	defer tmdbKeyLock.Unlock()
	tmdbApiKey = strings.TrimSpace(key)
}

// MaskTmdbKey ofusca a chave TMDB para exibição.
func MaskTmdbKey(key string) string {
	if len(key) <= 8 {
		if key != "" {
			return "••••"
		}
		return ""
	}
	return key[:4] + "…" + key[len(key)-4:]
}

// SetupDatabase inicializa o banco de cache (SQLite ou PostgreSQL).
func SetupDatabase() {
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
	DbCache, err = cache.NewCacheDB(driver, dsn)
	if err != nil {
		log.Fatalf("[meuplayer] Erro ao inicializar banco de cache: %v", err)
	}
	fmt.Printf("[meuplayer] cache: %s\n", DbCache.Driver())
}

// RunPeriodicCleanup remove periodicamente o cache de API expirado.
func RunPeriodicCleanup() {
	ticker := time.NewTicker(12 * time.Hour)
	for range ticker.C {
		_ = DbCache.CleanupExpired(time.Now().Unix())
	}
}

// SendJSONError envia um erro em JSON.
func SendJSONError(w http.ResponseWriter, status int, errStr, detail string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	resp := map[string]string{"error": errStr}
	if detail != "" {
		resp["detail"] = detail
	}
	_ = json.NewEncoder(w).Encode(resp)
}

// EnsureTmdbKey verifica se a chave TMDB está configurada.
func EnsureTmdbKey(w http.ResponseWriter) bool {
	if GetTmdbApiKey() != "" {
		return true
	}
	SendJSONError(w, http.StatusBadRequest, "TMDB_API_KEY não configurada", "Abra Configurações no menu e informe sua chave do TMDB")
	return false
}

// FetchWithCache busca uma URL externa usando o cache de API do banco.
func FetchWithCache(w http.ResponseWriter, cacheKey string, urlStr string, ttlSeconds int64, cleanBodyFunc func([]byte) []byte) {
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
		SendJSONError(w, http.StatusBadGateway, "Falha ao acessar API externa", err.Error())
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		SendJSONError(w, http.StatusBadGateway, "Falha ao ler resposta da API externa", err.Error())
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
