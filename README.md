# MeuPlayer

MeuPlayer e um aplicativo desktop de catalogo e player feito com Electron, um servidor Python local e frontend web. O app abre uma janela desktop, sobe um servidor HTTP local e entrega as telas da pasta `public`.

## Recursos

- Catalogo de filmes, series e animes com dados da API SuperFlix e metadados do TMDB.
- Player embutido para filmes, series e animes.
- Aba `Canais` com canais ao vivo carregados a partir de `public/canais.json`.
- Submenu lateral de canais com destaque do canal atual.
- Navegacao de canais por teclado:
  - `Seta para cima`: canal anterior.
  - `Seta para baixo`: proximo canal.
- Controles flutuantes na aba `Canais` para canal anterior, tentar play e proximo canal.
- Bloqueio de popups abertos por players externos.

## Stack

- Electron
- Python `http.server`
- React 18 via CDN na interface principal
- SQLite para cache local de API
- Electron Builder para empacotamento

## Como Rodar

Instale as dependencias:

```powershell
npm install
```

Inicie o app desktop:

```powershell
npm start
```

O Electron inicia o servidor Python local na porta `8765` e abre a interface em `http://localhost:8765/`.

## Variaveis de Ambiente

O servidor pode carregar um arquivo `.env` na raiz do projeto.

Variavel opcional:

```env
TMDB_API_KEY=sua_chave_tmdb
```

Sem essa chave, partes que dependem de detalhes, busca, generos e imagens do TMDB podem falhar ou ficar limitadas.

## Scripts

```powershell
npm start
npm run build:win
npm run build:linux
npm run build:mac
```

## Estrutura

- `main.js`: processo principal do Electron, criacao da janela, servidor Python, bloqueio de popups e atalhos globais da aba `Canais`.
- `server.py`: servidor HTTP local, rotas do app, proxies de API e cache.
- `public/app.jsx`: interface principal de filmes, series e animes.
- `public/canais.html`: tela de canais ao vivo.
- `public/canais.json`: lista de canais e URLs dos players.
- `public/nav.js`: navegacao comum do app.
- `cache.sqlite3`: cache local do projeto.

## Canais

A aba `Canais` usa os itens configurados em `public/canais.json`. Cada item deve ter um `id`, um `nome` e uma `src` com a URL do player.

Exemplo:

```json
{
  "id": "canal",
  "nome": "Nome do Canal",
  "src": "https://exemplo.com/player"
}
```

## Observacoes

- Players externos podem exigir interacao manual, bloquear embeds ou alterar comportamento sem aviso.
- O app tenta iniciar o player automaticamente simulando cliques no centro do iframe, mas alguns players podem exigir mais de uma tentativa.
- Arquivos de cache transientes, `node_modules`, `.env` e caches Python ficam ignorados pelo Git.
