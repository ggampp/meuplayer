# MeuPlayer

MeuPlayer e um aplicativo desktop de catalogo e player feito com Electron, um servidor Python local e frontend web. O app abre uma janela desktop, sobe um servidor HTTP local e entrega as telas da pasta `public`.

## Recursos

- Catalogo de filmes, series e animes com dados da API SuperFlix e metadados do TMDB.
- Cache persistente de metadados TMDB e imagens (SQLite ou PostgreSQL + disco para imagens).
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
- SQLite ou PostgreSQL para cache de API (configurável via `.env`)
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

# Opcional — PostgreSQL (VPS ou local). Omita para usar SQLite.
# CACHE_DATABASE_URL=postgresql://usuario:senha@localhost:5432/meuplayer
```

Sem chave, detalhes, busca, gêneros e imagens do TMDB ficam limitados.

### Cache PostgreSQL (opcional)

Por padrão o cache fica em SQLite (`cache.sqlite3` na pasta de dados do app). Para usar Postgres:

1. Instale o driver: `pip install -r requirements.txt`
2. Defina `CACHE_DATABASE_URL` no `.env` (veja `.env.example`)
3. **Local:** `docker compose -f docker-compose.postgres.yml up -d` cria um Postgres em `localhost:5432`
4. **VPS:** use a connection string do Postgres já existente no `.env` do deploy
5. Migração do SQLite antigo: `python scripts/migrate-cache-sqlite-to-postgres.py`

As **imagens** TMDB continuam em disco (`public/cache/images/tmdb`); só respostas de API e metadados vão para o banco.

No log do servidor aparece `[meuplayer] cache: sqlite` ou `cache: postgres`.

#### Deploy na VPS

O `docker-compose.yml` da raiz já está pronto para a VPS: o serviço `app` é
anexado à rede externa `database_default` (mantida pelo stack `database`), onde
o hostname `postgres` resolve para o Postgres compartilhado. Também participa
da rede `edge` para que o Traefik externo publique
`meuplayer.meusaplicativos.com` com TLS via Let's Encrypt.

Para subir basta preencher o `.env` da VPS com a connection string gerada no
painel `db.meusaplicativos.com` (apontando para `postgres:5432`) e rodar
`docker compose up -d`.

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
- `cache.sqlite3`: cache SQLite (quando `CACHE_DATABASE_URL` não está definida).
- `cache_db.py`: camada SQLite/PostgreSQL do cache.

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
