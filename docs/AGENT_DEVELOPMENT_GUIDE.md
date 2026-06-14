# Agent Development Guide — MeuPlayer

Regras para agentes (Cursor, Claude, etc.) trabalharem neste repositório com baixo custo de tokens.

## Princípios

- Leituras direcionadas (`grep`, `offset`/`limit`) em vez de arquivos inteiros.
- Specs pequenas em `docs/sprints/` — não reler `docs/SPRINTS.md` inteiro sem necessidade.
- Arquivos focados (< 350 linhas quando possível).
- Resumo curto ao fim de cada sprint em `docs/sprints/NNN-summary.md`.

## Estrutura de documentação

```
docs/
  ALIGNMENT_PLAN.md          # Fases de modularização
  SPRINTS.md                 # Índice (links)
  AGENT_DEVELOPMENT_GUIDE.md # Este arquivo
  sprints/
    000-overview.md
    001-anywhere-access.md
    001-summary.md
    ...
```

Tarefa ativa: copiar trecho relevante para `docs/sprints/XXX-current.md` e apagar ao concluir.

## Arquitetura do MeuPlayer

| Camada | Entrada principal | Notas |
|--------|-------------------|--------|
| Desktop | `main.js` | Electron, porta 8765 |
| Servidor | `main.go`, `db.go`, `handlers_*.go`, `server_core.go` | Go, cache SQLite/Postgres |
| Frontend VOD | `public/app.jsx` → `public/app.js` | React 18 CDN + Babel |
| TV / utilitários | `public/rede-buzz-ui.js`, `public/canais.html` | Workbench |
| Estilos | `public/styles.css` → `@import public/css/*` | Design system em `design.md` |
| Downloads | `public/downloads/` | **Versionado de propósito** — uso sem clonar repo |

**Raiz do repositório (alvo):** [sprints/007-root-layout.md](./sprints/007-root-layout.md) — o que fica na raiz vs `cmd/`, `internal/`, `public/`.

## Arquivos que agentes devem evitar ler por completo

- `public/app.jsx` (modularização Fase 4 pendente) — usar `grep` por componente
- `public/app.js` (gerado; editar só `app.jsx`)
- `public/css/*.css` — ler o partial da feature
- `handlers_tmdb.go` — buscar handler específico

## Verificação

```powershell
go build .
npm run build:frontend
```

## Início de uma tarefa

1. Ler `docs/sprints/XXX-current.md` (ou spec da issue).
2. Ler summaries anteriores relacionados.
3. Listar arquivos permitidos na spec.
4. Ao terminar: atualizar summary + checkbox na sprint.

Veja também [ALIGNMENT_PLAN.md](./ALIGNMENT_PLAN.md).
