# Plano de alinhamento — MeuPlayer

Documento mestre para alinhar código, documentação e práticas do `AGENT_DEVELOPMENT_GUIDE.md`.

**Atualizado:** 2026-05-25

## Decisões explícitas

| Item | Decisão |
|------|---------|
| `public/downloads/*` | **Permanece no repositório** — uso intencional para instalar em outra máquina sem clonar o repo |
| Stack do servidor | **Go** (`main.go`, `db.go`), não Python |
| `requirements.txt` | Legado/opcional; cache Postgres no servidor Go usa driver nativo |

## Fases

### Fase 1 — Documentação (concluída nesta entrega)

- [x] `README.md` atualizado (Go, scripts, rotas, estrutura)
- [x] `docs/SPRINTS.md` como índice enxuto
- [x] `docs/sprints/*.md` com specs e summaries
- [x] `docs/AGENT_DEVELOPMENT_GUIDE.md` versionado
- [x] `design.md` com família Netflix
- [x] `package.json` / `manifest.json` com owner `ggampp`
- [x] `SPRINTS.md` na raiz aponta para `docs/`

### Fase 2 — CSS modular (concluída nesta entrega)

- [x] Partials em `public/css/` (16 arquivos)
- [x] `public/styles.css` como agregador `@import`
- [x] Script `scripts/split-styles.py`

### Fase 3 — Backend Go modular (concluída nesta entrega)

- [x] `main.go` reduzido (~108 linhas)
- [x] Handlers em `handlers_*.go` e `server_core.go`
- [x] `go build` validado
- [x] Scripts: `split-main-go.py`, `fix-go-imports.py`

### Fase 4 — Frontend React modular (próxima)

**Objetivo:** quebrar `public/app.jsx` (~2200 linhas) em módulos Babel sem bundler.

**Passos sugeridos:**

1. Criar `public/js/catalog/` com:
   - `utils.js` — fetch, rotas, helpers TMDB
   - `components.js` — MediaCard, CastCard, CatalogFilters
   - `detail.js` — PersonDetail, tela de detalhe
   - `player-modal.js` — renderModal e estado do player
   - `app-shell.js` — componente App e bootstrap
2. Atualizar páginas HTML para carregar scripts na ordem correta (`type="text/babel"`).
3. Manter `npm run build:frontend` gerando `app.js` único para produção (`index.html`, `netflix.html`).
4. Meta: nenhum arquivo fonte > 400 linhas.

**Arquivos permitidos na Fase 4:** `public/app.jsx`, `public/js/**`, `public/*.html`, `package.json`.

### Fase 6 — Organização da raiz (concluída)

**Objetivo:** Raiz enxuta; código Go em `cmd/server` + `internal/`; remover protótipo legado.

**Spec completa:** [sprints/007-root-layout.md](./sprints/007-root-layout.md)

**Resumo do layout alvo:**

```
meuplayer/
├── README.md, design.md, SPRINTS.md    # docs de entrada
├── package.json, go.mod, main.js       # manifests desktop
├── Dockerfile, docker-compose*.yml     # deploy
├── cmd/server/main.go                 # bootstrap HTTP
├── internal/
│   ├── cache/db.go
│   ├── server/core.go
│   └── handlers/*.go
├── public/          # UI + downloads (versionados)
├── docs/            # planejamento
├── scripts/         # build, ícones
├── img/             # assets fonte
└── android/         # TV Box
```

**Tarefas principais:**

- [x] Remover `index.html`, `app.js`, `styles.css` da raiz (legado → só `public/`)
- [x] Mover handlers Go para `internal/handlers/`
- [x] `cmd/server/main.go` + ajustar `build-server.ps1` e `Dockerfile`
- [x] `.gitignore`: `meuplayer.exe`, `*.exe` na raiz (manter `public/downloads/`)
- [x] Atualizar README com árvore do repositório

**O que não muda:** `public/downloads/` no Git; `design.md` na raiz.

### Fase 7 — Manutenção contínua

- Ao fechar sprint: atualizar checkbox em `docs/sprints/` + `docs/sprints/NNN-summary.md`
- Novas páginas UI: registrar macroestrutura em `design.md` antes do código
- Agentes: ler só `docs/sprints/XXX-current.md` + arquivos listados na spec

## Métricas alvo

| Arquivo | Antes | Meta Fase 3 | Meta Fase 4 |
|---------|-------|-------------|-------------|
| `main.go` | ~1430 | < 150 | < 150 |
| `styles.css` | ~2200 | agregador ~30 | agregador ~30 |
| `app.jsx` | ~2200 | ~2200 | < 400 por partial |
| Arquivos na raiz | ~25+ | — | ≤ 15 entradas fixas (Fase 6) |

## Verificação após cada fase

```powershell
go build .
npm run build:frontend
npm start   # smoke test manual
```
