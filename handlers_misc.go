package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

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
		w.WriteHeader(http.StatusMethodNotAllowed)
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
