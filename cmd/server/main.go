package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"meuplayer/internal/handlers"
	"meuplayer/internal/server"
)

func main() {
	server.SetupPaths()
	server.LoadEnvFile()
	server.BootstrapTmdbKey()
	server.SetupDatabase()

	// Inicia limpeza periódica do cache
	go server.RunPeriodicCleanup()

	// Servidor HTTP
	mux := http.NewServeMux()

	// API e Proxies
	mux.HandleFunc("/api/settings", handlers.HandleSettings)
	mux.HandleFunc("/api/lista", handlers.HandleLista)
	mux.HandleFunc("/api/calendario", handlers.HandleCalendario)
	mux.HandleFunc("/api/tmdb", handlers.HandleTmdbDetail)
	mux.HandleFunc("/api/tmdb/genres", handlers.HandleTmdbGenres)
	mux.HandleFunc("/api/tmdb/search", handlers.HandleTmdbSearch)
	mux.HandleFunc("/api/tmdb/discover", handlers.HandleTmdbDiscover)
	mux.HandleFunc("/api/tmdb/season", handlers.HandleTmdbSeason)
	mux.HandleFunc("/api/tmdb/related", handlers.HandleTmdbRelated)
	mux.HandleFunc("/api/tmdb/credits", handlers.HandleTmdbCredits)
	mux.HandleFunc("/api/tmdb/person", handlers.HandleTmdbPerson)
	mux.HandleFunc("/api/tmdb/person/credits", handlers.HandleTmdbPersonCredits)
	mux.HandleFunc("/api/image/tmdb/", handlers.HandleTmdbImage)
	mux.HandleFunc("/api/guia", handlers.HandleGuia)
	mux.HandleFunc("/api/media/meta/batch", handlers.HandleMediaMetaBatch)
	mux.HandleFunc("/api/media/stored", handlers.HandleMediaStored)
	mux.HandleFunc("/api/rede-buzz/channels", handlers.HandleRedeBuzzChannels)
	mux.HandleFunc("/api/rede-buzz/categories", handlers.HandleRedeBuzzCategories)
	mux.HandleFunc("/api/rede-buzz/search", handlers.HandleRedeBuzzSearch)

	// Controle Remoto
	mux.HandleFunc("/api/remote/session", handlers.HandleRemoteSessionCreate)
	mux.HandleFunc("/api/remote/events", handlers.HandleRemoteEvents)
	mux.HandleFunc("/api/remote/command", handlers.HandleRemoteCommand)

	// Utilitários para multi-dispositivo e cache
	mux.HandleFunc("/api/client-env", handlers.HandleClientEnv)
	mux.HandleFunc("/api/channels/unified", handlers.HandleUnifiedChannels)
	mux.HandleFunc("/api/cache/stats", handlers.HandleCacheStats)
	mux.HandleFunc("/api/cache/clear", handlers.HandleCacheClear)

	// Páginas Estáticas e SPA fallback
	mux.HandleFunc("/", handlers.HandleStaticOrSPA)

	port := os.Getenv("PORT")
	if port == "" {
		port = server.Port
	}

	fmt.Printf("[meuplayer] Servidor iniciado em http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, server.CorsMiddleware(mux)))
}
