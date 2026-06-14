# Sprint 7 — Organização da raiz do projeto

**Objetivo:** Deixar a raiz do repositório previsível — só entradas de build/deploy, documentação principal e ponteiros; código e assets agrupados por função.

**Status:** Concluída (ver [ALIGNMENT_PLAN.md](../ALIGNMENT_PLAN.md) Fase 6)

---

## Situação atual (problemas)

| Item na raiz | Problema |
|--------------|----------|
| `index.html`, `app.js`, `styles.css` | Protótipo antigo; app real está em `public/` |
| `handlers_*.go`, `server_core.go`, `db.go` | 10+ arquivos Go soltos na raiz |
| `meuplayer.exe` | Artefato de build; não deveria ficar versionado |
| `cache.sqlite3` | Cache local de desenvolvimento |
| `requirements.txt` | Legado Python; scripts Go não dependem |
| `SPRINTS.md` + `docs/` | OK — atalho + docs completos |
| `design.md` | OK — convenção Hallmark (locked, na raiz) |

---

## Layout alvo

```
meuplayer/
├── README.md                    # Documentação principal
├── design.md                    # Design system (locked)
├── SPRINTS.md                   # Atalho → docs/SPRINTS.md
│
├── package.json                 # Electron + scripts npm
├── package-lock.json
├── go.mod
├── go.sum
│
├── main.js                      # Processo Electron
│
├── Dockerfile                   # Imagem VPS
├── docker-compose.yml
├── docker-compose.postgres.yml
├── .env.example
├── .gitignore
├── .dockerignore
│
├── cmd/
│   └── server/
│       └── main.go              # Apenas bootstrap + rotas HTTP
│
├── internal/
│   ├── cache/
│   │   └── db.go                # SQLite / PostgreSQL
│   ├── server/
│   │   └── core.go              # CORS, paths, fetchWithCache, TMDB key
│   └── handlers/
│       ├── static.go
│       ├── settings.go
│       ├── superflix.go
│       ├── tmdb.go
│       ├── rede_buzz.go
│       ├── remote.go
│       └── misc.go
│
├── public/                      # Estático (servido pelo Go)
│   ├── index.html, app.jsx, …
│   ├── css/
│   └── downloads/               # Versionado de propósito
│
├── docs/                        # Planejamento e guias
├── scripts/                     # Build, ícones, migração
├── img/                         # Assets fonte (ex.: app-de-tv.png)
└── android/                     # TV Box
```

**Pastas geradas (nunca na raiz, gitignored):** `node_modules/`, `dist/`, `dist-server/`, `build/`, `out/`, `*.exe` solto na raiz.

---

## Tarefas

### 7.1 Limpeza de legado na raiz

- [x] Remover ou arquivar `index.html`, `app.js`, `styles.css` da raiz (substituídos por `public/`)
- [x] Adicionar `meuplayer.exe` e `*.exe` na raiz ao `.gitignore` (exceto `public/downloads/`)
- [x] Mover `requirements.txt` → `scripts/python/requirements.txt`
- [x] Garantir `cache.sqlite3` fora do Git (`.gitignore` + `git rm --cached`)

### 7.2 Reorganizar Go (`internal/` + `cmd/`)

- [x] Criar `cmd/server/main.go` com `main()` e registro de rotas
- [x] Mover `db.go` → `internal/cache/db.go` (pacote `cache`)
- [x] Mover `server_core.go` → `internal/server/core.go` (pacote `server`)
- [x] Mover `handlers_*.go` → `internal/handlers/` (renomear sem prefixo `handlers_`)
- [x] Atualizar `scripts/build-server.ps1`: `go build -o dist-server/... ./cmd/server`
- [x] Atualizar `Dockerfile`: `go build` apontando para `./cmd/server`
- [x] Atualizar `main.js` dev: `go run ./cmd/server`
- [x] `go build ./...`, `go vet ./...` e smoke test do servidor

### 7.3 Documentação da raiz

- [x] Atualizar `README.md` — seção “Estrutura do repositório” + árvore
- [x] Atualizar `docs/AGENT_DEVELOPMENT_GUIDE.md` — mapa de pastas
- [x] Atualizar `docs/ALIGNMENT_PLAN.md` — marcar Fase 6 concluída

### 7.4 O que **permanece** na raiz (regra)

| Arquivo / pasta | Motivo |
|-----------------|--------|
| `README.md`, `design.md` | Entrada humana + design locked |
| `package.json`, `go.mod` | Manifests de build |
| `main.js` | Entry Electron (convenção) |
| `Dockerfile`, `docker-compose*.yml` | Deploy |
| `.env.example` | Template de config |
| `SPRINTS.md` | Atalho de 4 linhas |
| `public/`, `docs/`, `scripts/`, `android/`, `img/` | Árvores estáveis |

**Não mover:** `public/downloads/` — distribuição sem clone do repo.

---

## Ordem de execução recomendada

1. `.gitignore` + remover legado HTML/JS/CSS da raiz  
2. Mover Go para `internal/` + `cmd/server`  
3. Ajustar scripts de build e Docker  
4. Atualizar README e guias  

## Critérios de aceite

- Raiz com ≤ 15 entradas “fixas” (arquivos + pastas de primeiro nível, excluindo dotfiles)
- Nenhum `handlers_*.go` na raiz
- `go build` e `npm run build:win` funcionam
- README lista a árvore alvo

## Arquivos permitidos nesta sprint

`cmd/**`, `internal/**`, `main.go` (remoção/migração), `handlers_*.go`, `server_core.go`, `db.go`, `scripts/build-server.ps1`, `Dockerfile`, `main.js`, `.gitignore`, `README.md`, `docs/**`, remoção de `index.html`, `app.js`, `styles.css` na raiz.
