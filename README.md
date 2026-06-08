# MeuPlayer

MeuPlayer é um aplicativo desktop e TV Box de catálogo e player multimídia desenvolvido com Electron, um servidor Python local (com cache em banco de dados) e frontend web em React. O app abre uma janela desktop, sobe um servidor HTTP local e entrega as telas da pasta `public`.

## Recursos

- **Catálogo Multimídia:** Filmes, séries, animes e doramas com dados da API SuperFlix e metadados ricos do TMDB.
- **Cache Persistente:** Cache local e persistente de metadados TMDB e imagens para evitar requisições desnecessárias. Suporta **SQLite** (padrão) e **PostgreSQL** (configurável via `.env`).
- **Elenco e Filmografia:** Exibição do elenco detalhado na tela de informações do título. Permite clicar em qualquer ator/membro para abrir sua biografia detalhada e lista de trabalhos conhecidos (filmografia).
- **Player Imersivo:** Reprodutor de vídeo integrado com controles de episódios/temporadas rápidos e sistema de ocultação automática de barra de navegação/controles (fade-out ao ficar com o mouse parado).
- **Controle Remoto via SSE:** Permite controlar o aplicativo remotamente por outro dispositivo (como celular) a partir de Server-Sent Events (SSE). O QR code para emparelhamento fica nas Configurações do app.
- **Aba Canais & Rede Buzz:** Canais de TV ao vivo integrados a partir do `public/canais.json` ou via API do *Rei dos Embeds* na Rede Buzz.
- **Filtro de Conteúdo Adulto:** Proteção nativa que bloqueia categorias e metadados impróprios ou classificados como adultos nas listagens e buscas do TMDB e da Rede Buzz.
- **Navegação de Canais por Teclado:**
  - `Seta para cima`: canal anterior.
  - `Seta para baixo`: próximo canal.
- **Controles Flutuantes:** Painel flutuante com botões para canal anterior, tentar play (clique no iframe) e próximo canal.
- **Bloqueio de Popups:** Interceptação ativa no Electron que fecha automaticamente novas abas/popups geradas por propagandas de players externos.

## Stack

- Electron
- Python `http.server` + `sqlite3` ou `psycopg2` para cache
- React 18 via CDN na interface principal
- Docker & Docker Compose (para deploy em VPS)
- Android SDK (Projeto nativo de TVBox em `/android`)
- Electron Builder + PyInstaller (servidor Python embutido no `.exe`)

## Como Rodar (Desenvolvimento Desktop)

Instale as dependências:

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

O `docker-compose.yml` da raiz já está pronto para a VPS: o serviço `app` é anexado à rede externa `database_default` (mantida pelo stack `database`), onde o hostname `postgres` resolve para o Postgres compartilhado. Também participa da rede `edge` para que o Traefik externo publique `meuplayer.meusaplicativos.com` com TLS via Let's Encrypt.

Para subir basta preencher o `.env` da VPS com a connection string gerada no painel `db.meusaplicativos.com` (apontando para `postgres:5432`) e rodar `docker compose up -d`.

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

- `main.js`: processo principal do Electron, criação da janela, servidor Python, bloqueio de popups e atalhos globais da aba `Canais`.
- `server.py`: servidor HTTP local, rotas do app, proxies de API, controle remoto (SSE) e cache.
- `cache_db.py`: camada SQLite/PostgreSQL de cache.
- `public/app.jsx`: interface React principal (filmes, séries, animes, doramas, elenco, biografia de pessoas).
- `public/canais.html`: tela de canais ao vivo configurados.
- `public/canais.json`: lista de canais locais e URLs dos players.
- `public/rede-buzz.html`: tela Rede Buzz (canais da API do Rei dos Embeds).
- `public/rede-buzz-favoritos.html`: favoritos salvos da Rede Buzz.
- `public/remote.html`: interface do controle remoto para dispositivos móveis.
- `public/nav.js`: injeção da navegação comum e receptor de comandos do controle remoto (SSE).
- `android/`: projeto Android nativo configurado para TV Box.

## Controle Remoto (SSE)

O aplicativo conta com uma funcionalidade de controle remoto. 
1. Vá até a tela de **Configurações** no app desktop.
2. Escaneie o QR code gerado com o seu celular (ou acesse a URL informada na mesma página passando o token de sessão gerado).
3. Pela interface móvel (`/remote.html`), você conseguirá alternar entre abas (Filmes, Séries, Canais, etc.), realizar buscas textuais globais e avançar/retroceder canais ao vivo diretamente do telefone.

## Projeto Android (TV Box)

Na pasta `/android`, há um projeto Android nativo que envelopa o MeuPlayer em um `WebView` de tela cheia.
* **Foco em TVs:** Possui suporte a controles remotos convencionais (controle por setas/DPAD) e layout focado em tela cheia paisagem.
* **Compilação:** Abra a pasta `/android` no **Android Studio**, espere as dependências do Gradle sincronizarem e vá em `Build > Build Bundle(s) / APK(s) > Build APK(s)`. O APK gerado estará em `android/app/build/outputs/apk/debug/app-debug.apk`.
* **Configuração de URL:** Na primeira execução no TV Box, o aplicativo solicitará a URL da sua VPS (ex: `https://meuplayer.meusaplicativos.com`). O endereço fica salvo localmente. Se desejar alterá-lo futuramente, pressione a tecla **Menu** ou mantenha pressionada a tecla **Voltar** do controle remoto.

## Observações

- Players externos podem exigir interação manual, bloquear embeds ou alterar comportamento sem aviso.
- O app tenta iniciar o player automaticamente simulando cliques no centro do iframe, mas alguns players podem exigir mais de uma tentativa.
- Arquivos de cache transientes, `node_modules`, `.env` e caches Python ficam ignorados pelo Git.

