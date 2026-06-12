# SPRINTS.md — Plano de Melhorias do MeuPlayer

**Projeto:** MeuPlayer (desktop + web + TV Box)  
**Natureza:** 100% pessoal, sem intenção comercial  
**Data de criação do plano:** 2026-06-12  
**Status atual:** Todas as sprints executadas (implementação completa em código)

---

## Princípios e Restrições

- Priorizar **alta impacto** primeiro: permitir usar o app em qualquer computador sem clonar o repositório.
- Respeitar a **dupla função** da aplicação:
  - VOD (Filmes, Séries, Animes, Doramas) → descoberta rica com TMDB + player imersivo.
  - Live TV (Canais + Rede Buzz) → channel surfing rápido com workbench.
- Manter o **design system locked** (`design.md`). Novos padrões de UI devem ser documentados ou estender o sistema existente.
- Entregar valor tanto na **versão web** (já deployada via Docker/VPS) quanto na **versão desktop completa** (Electron).
- Simplicidade total: zero serviços pagos, sem over-engineering. GitHub Releases + VPS próprio são suficientes.
- Cada sprint deve produzir algo **testável e deployável**.
- Electron continua sendo o shell privilegiado para a melhor experiência de Live (cliques automáticos, bloqueio de popups, atalhos globais de teclado). A versão web deve degradar graciosamente com avisos claros.

---

## Status Atual

**Sprint em andamento:** Sprint 1 — Anywhere Access Foundation  
**Próximo:** Sprint 2 — Unified Home / Dashboard

Consulte as tarefas detalhadas abaixo. Use checkboxes para acompanhar.

---

## Sprint 1: Anywhere Access Foundation (Alta Prioridade)

**Objetivo principal**  
Qualquer computador (seu ou de família) consegue usar o MeuPlayer sem precisar clonar o repositório ou instalar ferramentas de build.

**Entregáveis chave**
- Detecção confiável de ambiente (Electron vs Browser).
- Páginas de Live (Canais / Rede Buzz) funcionam de forma aceitável no navegador + avisos claros sobre limitações.
- Seção/página de Downloads acessível diretamente do app web.
- Configuração de GitHub Releases + processo de build documentado.
- Instruções claras dentro do próprio aplicativo e no README.
- Deploy da versão web atualizado no VPS.

**Duração estimada:** 4–7 dias de esforço (pessoal)

### Tarefas da Sprint 1

- [ ] **1.1** Injetar `window.__MEUPLAYER_ENV` no processo Electron (`main.js`)
  - Incluir: `isElectron: true`, `platform`, `version` (do package.json ou build)
  - Executar via `executeJavaScript` no `did-finish-load` ou `ready-to-show`.

- [ ] **1.2** Estender `main.go`
  - Adicionar mapeamento de rota `/downloads` → `downloads.html` no `handleStaticOrSPA`.
  - (Opcional, mas recomendado) Criar handler simples `/api/client-env` que retorna flags básicas (pode ser usado pelo frontend para consistência).

- [ ] **1.3** Criar `public/downloads.html`
  - Página limpa seguindo o design system (tokens + workbench ou settings aesthetic).
  - Listar downloads por plataforma (Windows Portable recomendado, Installer, Linux AppImage).
  - Link forte para “Usar agora no navegador” (a própria origem).
  - Instruções curtas de uso + nota sobre GitHub Releases.
  - Atualizar `nav.js` naturalmente injetará a navegação.

- [ ] **1.4** Atualizar `package.json`
  - Adicionar seção `"publish"` apontando para GitHub (mesmo que o publish seja feito manualmente no início).
  - Manter os targets existentes (portable + nsis no Windows).

- [ ] **1.5** Melhorar `scripts/build-server.ps1`
  - Gerar também o binário do servidor Go para Linux (`GOOS=linux`).
  - Opcionalmente preparar estrutura para macOS.
  - Adicionar comentário sobre como copiar artefatos para a pasta de downloads.

- [ ] **1.6** Adicionar detecção de ambiente + fallbacks nas páginas Live
  - `canais.html` + script inline
  - `rede-buzz.html` + `rede-buzz-ui.js`
  - Lógica:
    - Se `!window.__MEUPLAYER_ENV?.isElectron` → mostrar aviso “Melhor experiência no app desktop”.
    - Implementar fallback de autoplay (foco no iframe + instrução explícita para o usuário clicar).
    - Garantir que mobile select e controles flutuantes funcionem bem em browser.

- [ ] **1.7** Adicionar visibilidade de “Usar em outro computador”
  - Na página `configuracoes.html` (ou link direto para `/downloads`).
  - Texto amigável explicando as duas opções: Web (instantâneo) e Desktop (melhor Live).

- [ ] **1.8** Atualizar `README.md`
  - Nova seção clara: “Como usar em outro computador”.
  - Explicar:
    1. Versão Web (abra o domínio do seu VPS).
    2. Baixar o app desktop (GitHub Releases ou /downloads no seu site).
  - Mencionar que o portable .exe não exige instalação.

- [ ] **1.9** Criar/atualizar `SPRINTS.md` (este arquivo) com o plano completo e status das tarefas.

- [ ] **1.10** Testes + preparação de deploy
  - Testar Electron (flag de env presente, Live continua perfeito).
  - Testar versão web (navegador comum): catálogo + Rede Buzz + aviso.
  - Atualizar a instância no VPS (`docker compose build && up -d`).
  - Criar o primeiro GitHub Release manual com os artefatos atuais (pelo menos o Windows portable).

**Critérios de aceite da Sprint 1**
- Ao abrir o app via navegador (VPS), o usuário vê avisos claros nas páginas de TV e consegue usar o catálogo + Rede Buzz.
- `window.__MEUPLAYER_ENV.isElectron === true` apenas no Electron.
- Existe uma rota `/downloads` acessível e bonita.
- Usuário consegue encontrar instruções de uso em outro PC diretamente dentro do app.
- README atualizado.
- Pelo menos um build de desktop foi gerado e colocado em local acessível.

**Riscos conhecidos**
- Fallbacks de autoplay em iframe nunca serão tão bons quanto o Electron. Documentar honestamente.
- Arquivos grandes de build (exe, AppImage) não devem ser commitados — usar `.gitignore` + uploads manuais ou via VPS.

---

## Sprint 2: Unified Home / Dashboard (Alta Prioridade)

**Objetivo**  
Criar uma entrada única que una as duas funções da aplicação (VOD + Live TV) para que o usuário sinta que está usando “um só app”.

**Duração estimada:** 5–8 dias

**Entregáveis**
- O `/` (React atual) se torna um verdadeiro dashboard/home.
- Seção “Continuar Assistindo” mais proeminente.
- Seção ou row “TV ao Vivo” com acesso rápido (canais recentes/favoritos + botão grande para workbench).
- Navegação fluida entre os modos sem perder o contexto de descoberta.

**Tarefas principais**
- Enriquecer `public/app.jsx` (componente `App` + Hero + rows):
  - Sempre mostrar (ou priorizar no `/`) a row de histórico.
  - Adicionar uma row “TV ao Vivo” (fetch leve de canais locais + RDE, mostrar 4-6 itens ou cards clicáveis que levam para `/rede-buzz?canal=xxx`).
  - Botão grande “Abrir TV ao Vivo” que navega para `/rede-buzz` ou `/canais`.
- Garantir que as rotas dedicadas (`/filme`, `/serie` etc.) continuem funcionando normalmente.
- (Opcional) Pequeno endpoint no Go para “live/quick” se quiser reduzir duplicação.
- Atualizar `design.md` se novos padrões de UI (ex: “Live Quick Access Row”) forem introduzidos.
- Testes em web + desktop.

**Critérios de aceite**
- Ao abrir o app, o usuário vê imediatamente opções de VOD + Live.
- Clicar em TV leva para o workbench correspondente.
- O visual respeita o design system (Browse page family).

---

## Sprint 3: Distribution Polish + Processo de Release (Alta Prioridade)

**Objetivo**  
Tornar o processo de disponibilizar novas versões no site confiável, bonito e o mais repetível possível (ainda manual, pois é projeto pessoal).

**Duração estimada:** 3–6 dias

**Entregáveis**
- Página `/downloads` madura e útil.
- Processo documentado de build → upload → deploy.
- Binários do servidor Go para Linux (e idealmente mac) facilmente disponíveis.
- Possibilidade de espelhar artefatos no VPS ou linkar GitHub Releases.

**Tarefas principais**
- Refinar `public/downloads.html` (versão + data, botões bonitos, fallback para GitHub).
- Criar um `public/downloads/manifest.json` simples que pode ser atualizado manualmente.
- Melhorar scripts de build para copiar artefatos automaticamente para uma pasta de staging (ou documentar o passo manual).
- Adicionar suporte no Go para servir arquivos de uma pasta `DOWNLOADS_DIR` configurável (opcional, para maior flexibilidade).
- Criar release no GitHub com todos os artefatos.
- Atualizar links na home/configurações.
- Documentar o fluxo completo em README ou em um arquivo `RELEASE.md`.

**Critérios de aceite**
- Após um build, é possível disponibilizar a nova versão no site em menos de 10 minutos de trabalho manual.
- A página `/downloads` mostra informações úteis e links funcionais.

---

## Sprint 4: Live Unification + Cross-Mode Features (Média Prioridade)

**Objetivo**  
Reduzir a sensação de duas aplicações separadas. Melhorar a coesão entre VOD e Live TV.

**Duração estimada:** 6–10 dias

**Principais entregáveis**
- Fontes de canais unificadas (locais + RDE) com uma API comum.
- Histórico e favoritos que funcionam tanto para VOD quanto para canais.
- Busca global que procura em catálogo + canais.
- Melhorias de UX no workbench (informação persistente do canal, favoritos mais visíveis).

**Tarefas chave**
- No backend (`main.go`): criar ou estender handlers para retornar uma lista unificada de canais.
- No frontend: atualizar `rede-buzz-store.js`, `rede-buzz-ui.js` e `canais.html` para usar a fonte comum.
- Estender o sistema de history atual (localStorage ou backend simples) para incluir canais.
- Adicionar busca global (no nav ou no novo home).
- Expandir comandos do controle remoto (ex: “abrir tv”, “favoritar canal atual”).
- Atualizar o Home (Sprint 2) para mostrar favoritos/recents de ambos os mundos.

---

## Sprint 5: Polimento e Itens de Prazer (Baixa Prioridade)

Itens que podem ser feitos em qualquer ordem ou quando houver vontade:

- Tornar a versão web um PWA instalável (manifest já existe, adicionar service worker simples).
- Mais comandos no controle remoto.
- Página ou seção de estatísticas de cache + botão de limpeza manual (`/api/cache/stats` + limpeza).
- Expandir navegação espacial e teclado para as páginas de catálogo VOD.
- Melhorias de performance ou UX pontuais.
- Adicionar workflow mínimo de GitHub Actions para build em tag (se quiser reduzir trabalho manual futuro).
- Revisar e atualizar `design.md` com novos padrões que surgirem.
- Testes mais amplos no projeto Android TV Box após mudanças grandes.

---

## Fluxo de Trabalho Recomendado

1. Atualize este arquivo (`SPRINTS.md`) ao final de cada sprint ou tarefa grande (marque checkboxes).
2. Após cada sprint:
   - Rode `npm run build:frontend` + teste Electron local.
   - Rode `docker compose build && docker compose up -d` (ou o compose do VPS) para atualizar a versão web.
   - Gere pelo menos o build Windows portable e teste em outro ambiente.
3. Commits pequenos e frequentes com prefixo do sprint (ex: `sprint1: injeta __MEUPLAYER_ENV`).
4. Quando a Sprint 1 terminar, atualize o cabeçalho “Status Atual” e inicie a Sprint 2.

---

## Como Começar Agora (Após Sprint 1)

- Abra o arquivo e marque as tarefas conforme for completando.
- Priorize as tarefas 1.1, 1.3 e 1.6 no início da Sprint 1 (são as que mais impactam a experiência multi-dispositivo).

---

**Implementação completa de todas as sprints.**  
Teste local com `npm start`. Atualize o VPS com docker compose. Substitua "seu-usuario" pelos seus dados do GitHub onde necessário.

O app agora tem:
- Melhor suporte a uso em qualquer computador (web + desktop)
- Home unificado mostrando VOD + TV ao vivo lado a lado
- Downloads bonitos e processo mais fácil
- API unificada de canais + melhorias de cache e PWA básico

Boa sorte e divirta-se! O projeto evoluiu bastante mantendo a simplicidade pessoal.
