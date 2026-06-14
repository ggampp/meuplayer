# Sprint 7 — summary

Raiz reorganizada. Código Go saiu da raiz para `cmd/server/main.go` (bootstrap + rotas) e `internal/`:

- `internal/cache/db.go` (pacote `cache`) — SQLite/PostgreSQL; novos métodos `Driver()`, `Counts()`, `CleanupExpired()`, `ClearAll()`.
- `internal/server/core.go` (pacote `server`) — paths, CORS, chave TMDB, `FetchWithCache`, constantes e globais (`DbCache`).
- `internal/handlers/*.go` (pacote `handlers`) — handlers HTTP, exportados como `Handle*`.

Legado removido da raiz (`index.html`, `app.js`, `styles.css`). `requirements.txt` → `scripts/python/`. `cache.sqlite3` desrastreado; `.gitignore` agora cobre binários da raiz (`*.exe`). `public/downloads/` permanece versionado.

Build/scripts ajustados para `./cmd/server` (`build-server.ps1`, `Dockerfile`, `main.js` dev). Validado com `go build ./...`, `go vet ./...` e smoke test (endpoints `/api/client-env`, `/api/cache/stats` e `/` respondendo).
