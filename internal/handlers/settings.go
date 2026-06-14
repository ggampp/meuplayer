package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"meuplayer/internal/server"
)

// HandleSettings lê e grava a chave TMDB em settings.json.
func HandleSettings(w http.ResponseWriter, r *http.Request) {
	settingsPath := filepath.Join(server.UserDataDir, "settings.json")

	if r.Method == "GET" {
		key := server.GetTmdbApiKey()
		resp := map[string]interface{}{
			"hasTmdbKey":     key != "",
			"tmdbKeyPreview": server.MaskTmdbKey(key),
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	if r.Method == "POST" {
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			server.SendJSONError(w, http.StatusBadRequest, "JSON inválido", err.Error())
			return
		}

		key, exists := body["tmdbApiKey"]
		if exists {
			key = strings.TrimSpace(key)
			server.SetTmdbApiKey(key)

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

		respKey := server.GetTmdbApiKey()
		resp := map[string]interface{}{
			"ok":             true,
			"hasTmdbKey":     respKey != "",
			"tmdbKeyPreview": server.MaskTmdbKey(respKey),
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
}
