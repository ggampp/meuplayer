package handlers

import (
	"meuplayer/internal/server"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestModuleRoutes(t *testing.T) {
	old := server.StaticDir
	server.StaticDir = t.TempDir()
	defer func() { server.StaticDir = old }()
	routes := map[string]string{"/": "home.html", "/vod": "index.html", "/vod/": "index.html", "/tv": "rede-buzz.html", "/tv/": "rede-buzz.html", "/tv/favoritos": "rede-buzz-favoritos.html", "/rede-buzz": "rede-buzz.html", "/rede-buzz-favoritos": "rede-buzz-favoritos.html", "/filme/123": "filme.html"}
	for _, file := range routes {
		if err := os.WriteFile(filepath.Join(server.StaticDir, file), []byte("shell:"+file), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for route, file := range routes {
		w := httptest.NewRecorder()
		HandleStaticOrSPA(w, httptest.NewRequest("GET", route, nil))
		if w.Code != 200 || !strings.Contains(w.Body.String(), "shell:"+file) {
			t.Errorf("%s: status %d body %s", route, w.Code, w.Body.String())
		}
	}
}
