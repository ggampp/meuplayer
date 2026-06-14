package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func handleRemoteSessionCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	token := generateSessionToken()
	sessionsLock.Lock()
	sessions[token] = &RemoteSession{
		CreatedAt: time.Now().Unix(),
		Clients:   make(map[chan string]bool),
	}
	sessionsLock.Unlock()

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"token": token})
}

// REMOTE CONTROL: Stream SSE (Server-Sent Events)
func handleRemoteEvents(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("session"))
	sessionsLock.Lock()
	session, exists := sessions[token]
	sessionsLock.Unlock()

	if !exists || time.Now().Unix()-session.CreatedAt >= RemoteSessionTtl {
		sendJSONError(w, http.StatusNotFound, "Sessão não encontrada ou expirada", "")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming sem suporte", http.StatusInternalServerError)
		return
	}

	// Registra o cliente na sessão
	clientChan := make(chan string, 10)
	session.Lock.Lock()
	session.Clients[clientChan] = true
	session.Lock.Unlock()

	defer func() {
		session.Lock.Lock()
		delete(session.Clients, clientChan)
		close(clientChan)
		session.Lock.Unlock()
	}()

	// Ping inicial / Keep alive
	_, _ = fmt.Fprint(w, ": ping\n\n")
	flusher.Flush()

	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, open := <-clientChan:
			if !open {
				return
			}
			_, err := fmt.Fprintf(w, "data: %s\n\n", msg)
			if err != nil {
				return
			}
			flusher.Flush()

		case <-ticker.C:
			_, err := fmt.Fprint(w, ": ping\n\n")
			if err != nil {
				return
			}
			flusher.Flush()

		case <-r.Context().Done():
			return
		}
	}
}

// REMOTE CONTROL: Receber Comandos
func handleRemoteCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sendJSONError(w, http.StatusBadRequest, "JSON inválido", err.Error())
		return
	}

	token := strings.TrimSpace(body["session"])
	action := strings.TrimSpace(body["action"])
	value := strings.TrimSpace(body["value"])

	if token == "" || action == "" {
		sendJSONError(w, http.StatusBadRequest, "session e action são obrigatórios", "")
		return
	}

	sessionsLock.Lock()
	session, exists := sessions[token]
	sessionsLock.Unlock()

	if !exists || time.Now().Unix()-session.CreatedAt >= RemoteSessionTtl {
		sendJSONError(w, http.StatusNotFound, "Sessão não encontrada ou expirada", "")
		return
	}

	msgMap := map[string]string{"action": action, "value": value}
	msgBytes, _ := json.Marshal(msgMap)
	msgStr := string(msgBytes)

	// Envia a mensagem a todos os clientes conectados a esta sessão (normalmente a janela principal do Electron)
	session.Lock.Lock()
	for clientChan := range session.Clients {
		select {
		case clientChan <- msgStr:
		default:
			// Buffer cheio, ignora ou remove cliente lento
		}
	}
	session.Lock.Unlock()

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true}`))
}

// Utils
func generateSessionToken() string {
	b := make([]byte, 20)
	_, _ = rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// API: Informações de ambiente para o cliente (usado para detecção)
