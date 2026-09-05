# MeuPlayer Web

Serviço web de VOD e TV ao vivo, com frontend React 18 + TypeScript + Vite e servidor Go. A página inicial permite escolher uma experiência independente.

| Rota | Experiência |
|---|---|
| `/` | Escolha entre VOD e TV |
| `/vod` | Filmes, séries, animes e doramas |
| `/tv` | Canais ao vivo, pesquisa e favoritos |
| `/tv/favoritos` | TV com filtro inicial de favoritos |
| `/configuracoes` | Configuração do serviço |

Links antigos de filmes, séries, animes, doramas, Rede Buzz e favoritos continuam funcionando. `/canais` mantém a fonte alternativa existente.

## Executar como serviço web

Requisitos: Node.js 20+ e Go compatível com `go.mod`.

```powershell
npm install
npm start
```

`npm start` compila o frontend e inicia o servidor Go. A porta padrão é 8765; pode ser alterada com `PORT`.

```powershell
$env:PORT="3000"
npm start
```

Configure `TMDB_API_KEY` no `.env` local ou na configuração do servidor. Não versione credenciais. O catálogo e a reprodução dependem das respectivas fontes externas.

### Docker

```powershell
docker compose up -d --build
```

Acesso em `http://localhost:3000`. O volume `/data` persiste o cache/configurações; SQLite é o padrão, PostgreSQL é opcional via `CACHE_DATABASE_URL`. O serviço não depende de Electron.

## Pesquisa

- **VOD:** nome, tipo, gênero, ano, situação, emissora/produtora e nota mínima; ordenação por relevância, popularidade, lançamento, avaliação ou título. Consultas remotas paginadas. Filtros complementares e ordenação refinam os títulos da página carregada; a interface informa essa abrangência.
- **TV:** nome/identificador, categoria e favoritos combinados, busca sem distinção de acentos e ordem A–Z/Z–A sobre os canais carregados. Alterar a pesquisa não interrompe nem troca o canal em reprodução.
- Filtros são preservados na URL. Histórico VOD e favoritos TV permanecem no navegador com as mesmas chaves anteriores, sem migração destrutiva.

## Organização

```text
src/
  app/                  entrada VOD e seleção dos módulos
  modules/
    vod/
      pages/            coordenação de catálogo e navegação
      components/       pesquisa, detalhes, player e cartões
      hooks/            consulta paginada e histórico
      lib/              API e regras VOD
      types/            tipos do domínio
    tv/                 aplicação TV, canais, pesquisa e favoritos
  shared/lib/           HTTP com cancelamento e normalização de busca
  nav/                  navegação compartilhada
internal/
  handlers/             APIs, validação de filtros e rotas web
  server/               infraestrutura e configuração
  cache/                SQLite/PostgreSQL
public/
  css/modules.css       layout dos módulos
  tokens.css            tokens do design
  js/                   bundles gerados pelo Vite
```

Edite `src/`, não os bundles em `public/js/`. Os arquivos JS/JSX antigos na raiz de `public/` são legado e não são a fonte dos novos módulos.

## Verificação e clientes opcionais

```powershell
npm run typecheck
npm run test:search
npm run build:frontend
go test ./...
npm run start:desktop
```

Electron continua como cliente opcional. Android TV continua em `android/`, usando a URL do serviço. Builds desktop usam os scripts `build:win`, `build:linux` e `build:mac`; executáveis de distribuição ficam em `public/downloads/`.

A configuração administrativa atual é compartilhada no servidor; a entrega não inclui autenticação ou sincronização de contas. Antes de disponibilizar administração na internet, restringir seu acesso na infraestrutura ou implementar autorização.

Decisões e análise: [docs/WEB_MODULES_PROPOSAL.md](docs/WEB_MODULES_PROPOSAL.md). Identidade visual: [design.md](design.md).
