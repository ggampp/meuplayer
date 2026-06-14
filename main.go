package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
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
