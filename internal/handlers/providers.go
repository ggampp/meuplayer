package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"meuplayer/internal/server"
)

type Provider struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Icon      string `json:"icon"`
	IsDefault bool   `json:"isDefault,omitempty"`
	Category  string `json:"category,omitempty"`
}

var (
	providersLock sync.RWMutex
)

// DefaultProviders define os provedores pré-configurados solicitados.
func GetDefaultProviders() []Provider {
	return []Provider{
		{
			ID:        "max",
			Name:      "Max",
			URL:       "https://www.hbomax.com/br/pt",
			Icon:      "/img/providers/max.svg",
			IsDefault: true,
			Category:  "Streaming",
		},
		{
			ID:        "netflix",
			Name:      "Netflix",
			URL:       "https://www.netflix.com/browse",
			Icon:      "/img/providers/netflix.svg",
			IsDefault: true,
			Category:  "Streaming",
		},
		{
			ID:        "recordplus",
			Name:      "Record Plus",
			URL:       "https://www.recordplus.com/Live/LiveEvent/180?groupId=7",
			Icon:      "/img/providers/recordplus.svg",
			IsDefault: true,
			Category:  "TV Ao Vivo",
		},
		{
			ID:        "primevideo",
			Name:      "Prime Video",
			URL:       "https://www.primevideo.com/region/na/storefront",
			Icon:      "/img/providers/primevideo.svg",
			IsDefault: true,
			Category:  "Streaming",
		},
	}
}

func getProvidersFilePath() string {
	return filepath.Join(server.UserDataDir, "providers.json")
}

func loadCustomProviders() ([]Provider, error) {
	filePath := getProvidersFilePath()
	if _, err := os.Stat(filePath); err != nil {
		return []Provider{}, nil
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return []Provider{}, err
	}
	var list []Provider
	if err := json.Unmarshal(data, &list); err != nil {
		return []Provider{}, nil
	}
	return list, nil
}

func saveCustomProviders(providers []Provider) error {
	filePath := getProvidersFilePath()
	data, err := json.MarshalIndent(providers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

// HandleProviders lida com GET (listar), POST (adicionar/atualizar) e DELETE (remover).
func HandleProviders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	switch r.Method {
	case http.MethodGet:
		providersLock.RLock()
		defer providersLock.RUnlock()

		custom, _ := loadCustomProviders()
		defaults := GetDefaultProviders()

		all := append(defaults, custom...)
		json.NewEncoder(w).Encode(all)

	case http.MethodPost:
		providersLock.Lock()
		defer providersLock.Unlock()

		var input Provider
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			server.SendJSONError(w, http.StatusBadRequest, "Payload inválido", err.Error())
			return
		}

		input.Name = strings.TrimSpace(input.Name)
		input.URL = strings.TrimSpace(input.URL)
		input.Icon = strings.TrimSpace(input.Icon)

		if input.Name == "" || input.URL == "" {
			server.SendJSONError(w, http.StatusBadRequest, "Nome e URL são obrigatórios", "")
			return
		}

		if !strings.HasPrefix(input.URL, "http://") && !strings.HasPrefix(input.URL, "https://") {
			input.URL = "https://" + input.URL
		}

		if input.Icon == "" {
			input.Icon = "/img/providers/default-provider.svg"
		}

		if input.ID == "" {
			input.ID = "custom_" + time.Now().Format("20060102150405")
		}

		custom, _ := loadCustomProviders()
		found := false
		for i, p := range custom {
			if p.ID == input.ID {
				custom[i] = input
				found = true
				break
			}
		}
		if !found {
			custom = append(custom, input)
		}

		if err := saveCustomProviders(custom); err != nil {
			server.SendJSONError(w, http.StatusInternalServerError, "Erro ao salvar provedor", err.Error())
			return
		}

		json.NewEncoder(w).Encode(input)

	case http.MethodDelete:
		providersLock.Lock()
		defer providersLock.Unlock()

		id := r.URL.Query().Get("id")
		if id == "" {
			server.SendJSONError(w, http.StatusBadRequest, "ID não informado", "")
			return
		}

		custom, _ := loadCustomProviders()
		newList := make([]Provider, 0, len(custom))
		for _, p := range custom {
			if p.ID != id {
				newList = append(newList, p)
			}
		}

		if err := saveCustomProviders(newList); err != nil {
			server.SendJSONError(w, http.StatusInternalServerError, "Erro ao remover provedor", err.Error())
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "deleted": id})

	default:
		server.SendJSONError(w, http.StatusMethodNotAllowed, "Método não suportado", "")
	}
}
