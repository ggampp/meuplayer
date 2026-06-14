# MeuPlayer

MeuPlayer é um aplicativo desktop e TV Box de catálogo e player multimídia: **Electron** + **servidor Go** local (cache em banco) + frontend **React 18** (CDN/Babel). O app abre uma janela desktop, sobe HTTP na porta `8765` e entrega as telas de `public/`.

## Recursos

- **Catálogo:** Filmes, séries, animes e doramas (SuperFlix + metadados TMDB).
- **Layout Netflix:** Rota `/netflix` com fileiras horizontais.
- **Cache:** SQLite (padrão) ou PostgreSQL (`CACHE_DATABASE_URL`).
- **Elenco e filmografia:** Detalhe de título e página de ator.
- **Player imersivo:** Tela cheia, controles com auto-hide, botão flutuante para detalhes.
- **Controle remoto (SSE):** QR em Configurações → `/remote.html`.
- **TV ao vivo:** `canais.json`, Rede Buzz, favoritos; menu flutuante com auto-hide.
- **Filtro adulto:** Bloqueio em TMDB e Rede Buzz.
- **Downloads no site:** `/downloads` com executáveis hospedados em `public/downloads/` (versionados para uso sem clonar o repo).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Desktop | Electron 35 |
| Servidor | Go (`main.go`, `handlers_*.go`, `db.go`) |
| Frontend | React 18 via CDN; `app.jsx` → `app.js` (Babel) |
| Cache | SQLite / PostgreSQL |
| Deploy | Docker Compose + Traefik (VPS) |
| TV Box | Android (`/android`) |

## Como rodar (desenvolvimento)

```powershell
npm install
npm start
```

`npm start` compila o frontend (`build:frontend`) e abre o Electron. Em dev o servidor sobe com `go run ./cmd/server`.

Requisitos: **Node.js**, **Go 1.22+** (para desenvolvimento e build do servidor).

## Configurações (TMDB)

Menu **Configurações** ou `%APPDATA%\meuplayer\settings.json` (Windows).

`.env` na raiz (desenvolvimento):

```env
TMDB_API_KEY=sua_chave_tmdb
# CACHE_DATABASE_URL=postgresql://usuario:senha@localhost:5432/meuplayer
```

## Scripts

```powershell
npm start                 # dev Electron
npm run build:frontend    # app.jsx → app.js
npm run icons             # favicons e ícones (img/app-de-tv.png)
npm run build:server      # meuplayer-server.exe + binário Linux
npm run build:win         # instalador + portable
npm run build:linux
npm run build:mac
```

## Estrutura

| Arquivo / pasta | Função |
|-----------------|--------|
| `main.js` | Electron, janela, spawn do servidor Go |
| `cmd/server/main.go` | Bootstrap HTTP + registro de rotas |
| `internal/cache/db.go` | Cache SQLite / PostgreSQL |
| `internal/server/core.go` | Paths, CORS, chave TMDB, `FetchWithCache` |
| `internal/handlers/*.go` | Handlers HTTP (tmdb, superflix, rede_buzz, remote, settings, static, misc) |
| `public/app.jsx` | UI React principal |
| `public/app.js` | Build de produção (gerado) |
| `public/css/` | Partials de estilo |
| `public/styles.css` | Agregador `@import` |
| `public/netflix.html` | Layout estilo Netflix |
| `public/rede-buzz*.html` | TV ao vivo |
| `public/downloads/` | Executáveis para outras máquinas |
| `design.md` | Design system (locked) |
| `docs/` | Sprints, guia de agentes, plano de alinhamento |

Árvore do repositório:

```
meuplayer/
├── README.md, design.md, SPRINTS.md     # docs de entrada
├── package.json, go.mod, main.js        # manifests desktop
├── Dockerfile, docker-compose*.yml      # deploy
├── cmd/server/main.go                   # bootstrap HTTP + rotas
├── internal/
│   ├── cache/db.go                      # SQLite / PostgreSQL
│   ├── server/core.go                   # paths, CORS, TMDB, FetchWithCache
│   └── handlers/*.go                    # handlers HTTP
├── public/                              # UI + downloads (versionados)
├── docs/                                # planejamento e guias
├── scripts/                             # build, ícones, python/
├── img/                                 # assets fonte
└── android/                             # TV Box
```

Mapa completo (com regras): [docs/sprints/007-root-layout.md](./docs/sprints/007-root-layout.md).

## Usar em outro computador

1. **Web:** abra a URL do VPS (ex. `https://meuplayer.meusaplicativos.com`).
2. **Desktop:** `/downloads` no mesmo site — portable ou instalador em `public/downloads/`.
3. Configure a chave TMDB em cada máquina nova.

## Planejamento e agentes

- [docs/SPRINTS.md](./docs/SPRINTS.md) — índice de sprints
- [docs/ALIGNMENT_PLAN.md](./docs/ALIGNMENT_PLAN.md) — modularização (Fases 4–6)
- [docs/sprints/007-root-layout.md](./docs/sprints/007-root-layout.md) — organização da raiz
- [docs/AGENT_DEVELOPMENT_GUIDE.md](./docs/AGENT_DEVELOPMENT_GUIDE.md)

## Android (TV Box)

Pasta `/android` — WebView fullscreen, DPAD, URL da VPS na primeira execução.

Build: Android Studio → `Build APK` → `android/app/build/outputs/apk/debug/app-debug.apk`.

## Observações

- Players externos podem bloquear embed ou exigir clique manual.
- `public/downloads/` fica no Git **de propósito** para distribuição direta.
- `cache.sqlite3`, `.env` e `node_modules` não devem ser commitados.
