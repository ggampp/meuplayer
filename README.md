# MeuPlayer

MeuPlayer e um aplicativo desktop de catalogo e player feito com Electron, um servidor Python local e frontend web. O app abre uma janela desktop, sobe um servidor HTTP local e entrega as telas da pasta `public`.

## Recursos

- Catalogo de filmes, series e animes com dados da API SuperFlix e metadados do TMDB.
- Cache persistente local de metadados TMDB e imagens ja consultadas (SQLite + disco).
- Player embutido para filmes, series e animes.
- Aba `Canais` com canais ao vivo carregados a partir de `public/canais.json`.
- Aba `Rede Buzz` com canais da API [Rei dos Embeds](https://reidosembeds.com/doc) (embed `rde.buzz`).
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
- Electron Builder + PyInstaller (servidor embutido no `.exe`)

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

## Configurações (API TMDB)

No app, abra **Configurações** no menu e cole sua chave da API v3 do [TMDB](https://www.themoviedb.org/settings/api). A chave é salva em:

`%APPDATA%\meuplayer\settings.json` (Windows)

Em desenvolvimento, o servidor também aceita `.env` na raiz do projeto:

```env
TMDB_API_KEY=sua_chave_tmdb
```

Sem chave, detalhes, busca, gêneros e imagens do TMDB ficam limitados.

## Scripts

```powershell
npm start
npm run build:server   # gera meuplayer-server.exe (PyInstaller)
npm run build:win      # instalador + portátil (inclui Python embutido)
npm run build:linux
npm run build:mac
```

O build do Windows **não exige Python instalado** na máquina do usuário: o `meuplayer-server.exe` vai junto no instalador. Para compilar, você ainda precisa de Python + PyInstaller (`npm run build:server`).

## Estrutura

- `main.js`: processo principal do Electron, criacao da janela, servidor Python, bloqueio de popups e atalhos globais da aba `Canais`.
- `server.py`: servidor HTTP local, rotas do app, proxies de API e cache.
- `public/app.jsx`: interface principal de filmes, series e animes.
- `public/canais.html`: tela de canais ao vivo.
- `public/rede-buzz.html`: tela Rede Buzz (Rei dos Embeds).
- `public/rede-buzz-favoritos.html`: canais favoritos da Rede Buzz (salvos no navegador).
- `public/rede-buzz-store.js` / `public/rede-buzz-ui.js`: favoritos e UI compartilhada das abas Buzz.
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
