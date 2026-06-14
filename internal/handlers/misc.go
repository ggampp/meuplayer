package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"meuplayer/internal/server"
)

// HandleClientEnv expõe informações de ambiente para detecção no cliente.
func HandleClientEnv(w http.ResponseWriter, r *http.Request) {
	key := server.GetTmdbApiKey()
	resp := map[string]interface{}{
		"isElectron":     false,
		"hasTmdbKey":     key != "",
		"tmdbKeyPreview": server.MaskTmdbKey(key),
		"serverVersion":  "go",
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(resp)
}

// HandleUnifiedChannels combina canais locais (canais.json) e da Rede Buzz (RDE) — Sprint 4.
func HandleUnifiedChannels(w http.ResponseWriter, r *http.Request) {
	// Carrega canais locais
	localPath := filepath.Join(server.StaticDir, "canais.json")
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
	rdeURL := fmt.Sprintf("%s/channels", server.RdeApiBase)
	resp, err := http.Get(rdeURL)
	rdeChannels := []map[string]interface{}{}
	if err == nil {
		defer resp.Body.Close()
		var payload struct {
			Success bool                     `json:"success"`
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

// HandleCacheStats retorna estatísticas do banco de cache (Sprint 5).
func HandleCacheStats(w http.ResponseWriter, r *http.Request) {
	if server.DbCache == nil {
		server.SendJSONError(w, http.StatusInternalServerError, "Cache não inicializado", "")
		return
	}

	apiCount, metaCount, _ := server.DbCache.Counts()

	stats := map[string]interface{}{
		"driver":               server.DbCache.Driver(),
		"api_cache_count":      apiCount,
		"media_metadata_count": metaCount,
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(stats)
}

// HandleCacheClear limpa o cache expirado ou tudo (?all=1) — Sprint 5.
func HandleCacheClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if server.DbCache == nil {
		server.SendJSONError(w, http.StatusInternalServerError, "Cache não inicializado", "")
		return
	}

	// Limpa apenas expirados por padrão, ou tudo se ?all=1
	all := r.URL.Query().Get("all") == "1"

	var err error
	if all {
		err = server.DbCache.ClearAll()
	} else {
		err = server.DbCache.CleanupExpired(time.Now().Unix())
	}

	if err != nil {
		server.SendJSONError(w, http.StatusInternalServerError, "Falha ao limpar cache", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"ok": "true", "cleared": "expired"})
}
