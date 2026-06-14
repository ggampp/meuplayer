package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func filterRedeBuzzPayload(data []byte) []byte {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return data
	}

	items, ok := payload["data"]
	if !ok {
		return data
	}

	// Se for uma lista (canais ou categorias)
	if arr, ok := items.([]interface{}); ok {
		var filtered []interface{}
		for _, item := range arr {
			if m, ok := item.(map[string]interface{}); ok {
				// Verifica se é categoria adulta
				if isRdeAdultCategory(m["id"]) || isRdeAdultCategory(m["name"]) || isRdeAdultCategory(m["category"]) || isRdeAdultCategory(m["category_id"]) || isRdeAdultCategory(m["categoryId"]) {
					continue
				}
				filtered = append(filtered, m)
			} else {
				filtered = append(filtered, item)
			}
		}
		payload["data"] = filtered
		if _, ok := payload["total"]; ok {
			payload["total"] = len(filtered)
		}
	} else if m, ok := items.(map[string]interface{}); ok {
		// Se for um único canal contendo um objeto
		if isRdeAdultCategory(m["category"]) || isRdeAdultCategory(m["category_id"]) || isRdeAdultCategory(m["categoryId"]) {
			payload["data"] = nil
		} else if channels, ok := m["channels"].([]interface{}); ok {
			var filtered []interface{}
			for _, ch := range channels {
				if cm, ok := ch.(map[string]interface{}); ok {
					if isRdeAdultCategory(cm["category"]) || isRdeAdultCategory(cm["category_id"]) || isRdeAdultCategory(cm["categoryId"]) {
						continue
					}
					filtered = append(filtered, cm)
				}
			}
			m["channels"] = filtered
			payload["data"] = m
		}
	}

	res, err := json.Marshal(payload)
	if err != nil {
		return data
	}
	return res
}

func isRdeAdultCategory(val interface{}) bool {
	if val == nil {
		return false
	}
	s := strings.ToLower(strings.TrimSpace(fmt.Sprintf("%v", val)))
	return s == RdeAdultCategory
}

// API: Canais da Rede Buzz
func handleRedeBuzzChannels(w http.ResponseWriter, r *http.Request) {
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	if isRdeAdultCategory(category) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write([]byte(`{"success":true,"data":[],"total":0}`))
		return
	}

	var urlStr, cacheKey string
	if category != "" {
		urlStr = fmt.Sprintf("%s/channels?category=%s", RdeApiBase, url.QueryEscape(category))
		cacheKey = fmt.Sprintf("rde:channels:cat:%s", strings.ToLower(category))
	} else {
		urlStr = fmt.Sprintf("%s/channels", RdeApiBase)
		cacheKey = "rde:channels:all"
	}

	fetchWithCache(w, cacheKey, urlStr, TtlRdeSeconds, filterRedeBuzzPayload)
}

// API: Categorias da Rede Buzz
func handleRedeBuzzCategories(w http.ResponseWriter, r *http.Request) {
	urlStr := fmt.Sprintf("%s/channels/categories", RdeApiBase)
	fetchWithCache(w, "rde:categories", urlStr, TtlRdeSeconds, filterRedeBuzzPayload)
}

// API: Pesquisa da Rede Buzz
func handleRedeBuzzSearch(w http.ResponseWriter, r *http.Request) {
	term := strings.TrimSpace(r.URL.Query().Get("q"))
	if term == "" {
		sendJSONError(w, http.StatusBadRequest, "Parâmetro q é obrigatório", "")
		return
	}
	urlStr := fmt.Sprintf("%s/pesquisa?q=%s", RdeApiBase, url.QueryEscape(term))
	cacheKey := fmt.Sprintf("rde:search:%s", strings.ToLower(term))
	fetchWithCache(w, cacheKey, urlStr, TtlRdeSeconds, filterRedeBuzzPayload)
}

// REMOTE CONTROL: Criar Sessão
