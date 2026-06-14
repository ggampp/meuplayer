package handlers

import (
	"net/http"
	"path/filepath"
	"strings"

	"meuplayer/internal/server"
)

// HandleStaticOrSPA resolve rotas amigáveis da SPA e serve arquivos estáticos.
func HandleStaticOrSPA(w http.ResponseWriter, r *http.Request) {
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
	} else if path == "/netflix" || path == "/netflix/" {
		target = "netflix.html"
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
		http.ServeFile(w, r, filepath.Join(server.StaticDir, target))
		return
	}

	// Caso contrário, serve o arquivo estático diretamente
	http.FileServer(http.Dir(server.StaticDir)).ServeHTTP(w, r)
}
