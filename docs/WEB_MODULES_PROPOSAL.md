# MeuPlayer Web: análise e proposta de módulos

Data: 2026-09-05. Estado: direção aprovada e implementada em 2026-09-05. O diagnóstico abaixo registra a situação anterior.

## Diagnóstico do código

- O serviço web já existe: `cmd/server/main.go` registra HTTP/APIs, `internal/handlers/static.go` resolve páginas e o Docker compila Node + Go, expõe a porta 3000 e persiste `/data`.
- Electron é um cliente adicional; não é necessário para executar o serviço web. O comando `npm start` ainda prioriza Electron.
- O frontend atual usa React 18, TypeScript e Vite, com múltiplas entradas. O README e o plano de alinhamento ainda contêm referências antigas a CDN/Babel.
- `src/app/App.tsx` concentra busca, catálogo, histórico, temporadas, detalhes e modal de reprodução. Usa `@ts-nocheck`; separar pastas sem extrair essas responsabilidades não resolve o acoplamento.
- `src/nav/config.ts` mistura catálogo, TV e plataformas externas no mesmo hub. A raiz abre diretamente o catálogo.
- VOD já possui nome, gênero, ano, situação e emissora. Parte dos filtros atua sobre resultados carregados; não representa uma consulta global paginada. Ordenação por lançamento está fixa no componente.
- TV usa `src/rede-buzz-ui.ts`, com manipulação direta do DOM, mais um armazenamento de favoritos separado. Trocar categoria limpa a busca; pesquisar chama um endpoint sem categoria. Os filtros não são combináveis no fluxo atual.
- Histórico VOD e favoritos TV usam localStorage: pertencem ao navegador, não a uma conta sincronizada.
- O handler de configurações aceita alteração da chave TMDB por POST sem autenticação no próprio handler. Rever o controle administrativo para hospedagem pública.
- Verificação inicial: `npm run typecheck` falhou com quatro erros em `src/player.ts` relativos à declaração global e à ponte Electron. Não foi validada reprodução real nem executado deploy.

## Arquitetura proposta

Manter um serviço Go e um deploy Docker, com módulos de produto independentes no frontend:

```text
src/
  app/                 bootstrap, rotas e seleção de módulo
  modules/
    vod/
      pages/           catálogo, detalhes e pesquisa
      components/      cartões, temporadas e player VOD
      hooks/           catálogo, pesquisa e histórico
      services/        consultas VOD e metadados
      types/
    tv/
      pages/           canais e favoritos
      components/      lista, filtros e player ao vivo
      hooks/           pesquisa, seleção e favoritos
      services/        consultas de canais
      types/
  shared/
    components/        cabeçalho, campos, feedback e botões
    lib/               HTTP, armazenamento e utilitários comuns
    styles/            tokens, tipografia e responsividade
```

Cada módulo terá sua entrada e carregará apenas sua experiência. O backend mantém cache e infraestrutura compartilhados; agrupar registro de rotas VOD e TV sem duplicar servidor ou banco.

Rotas propostas: `/` para escolha, `/vod` para catálogo e `/tv` para TV. Links antigos de títulos, canais e favoritos devem continuar resolvendo, preservando identificadores, parâmetros de reprodução e chaves de armazenamento.

## Experiência e pesquisa

- Entrada: duas áreas grandes e acessíveis por teclado, “Filmes e séries” e “TV ao vivo”. Sempre permitir trocar de módulo pelo cabeçalho.
- VOD: destaque com imagem real do catálogo, continuar assistindo e coleções. Busca visível, filtros combinados por tipo, gênero, ano e nota mínima; ordenação por relevância, popularidade, lançamento e título. Manter situação/emissora quando os metadados permitirem distinção correta.
- TV: player com lista de canais persistente, categorias e favoritos. Busca por nome/identificador combinada com categoria e favoritos; ordenação alfabética. Não inventar filtros de resolução ou programação sem dados fornecidos pela origem.
- Ambos: filtros na URL, limpar filtros, estados de carregamento/erro/vazio, navegação por teclado, cancelamento de respostas obsoletas e paginação quando suportada pela fonte. Contagens devem indicar quando se referem apenas aos resultados carregados.

## Direção visual proposta

Redesign com reorganização da navegação, preservando reprodução e identidade MeuPlayer. Público: uso diário em desktop, celular e navegador de TV. Linguagem: cinema escuro, composição ampla e controles claros.

- Fundo azul profundo, superfícies grafite, texto branco suave e âmbar como destaque, seguindo a identidade existente.
- Títulos sem serifa com Segoe UI Variable/Segoe UI, corpo legível; escala de espaços baseada em 8 px.
- Cantos de 12–20 px e sombras discretas apenas para sobreposições.
- Entrada espaçosa; VOD visual com pôsteres reais; TV mais compacta e orientada à seleção de canais.
- Transições de 160–220 ms, foco visível e respeito a movimento reduzido.
- Calibração: variação visual 6/10, movimento 3/10, densidade 5/10 (TV 7/10), dependência de imagens 7/10, fidelidade à marca 8/10.
- Reutilizar logo e assets existentes; não apresentar títulos, audiência ou disponibilidade fictícios.

## Sequência de implementação e aceite

1. Corrigir a base de tipagem e registrar build inicial.
2. Criar seleção de módulos, novas rotas e compatibilidade com links antigos.
3. Extrair VOD por responsabilidade e implementar pesquisa combinada/paginada.
4. Extrair TV, combinar filtros e preservar reprodução durante a pesquisa.
5. Aplicar o sistema visual responsivo e atualizar documentação para web como fluxo principal.
6. Validar tipagem, build frontend e testes Go; cobrir roteamento e combinação de filtros com testes de comportamento. Validar reprodução com fontes disponíveis e documentar dependências externas.

Aceite: raiz permite escolher módulo; cada módulo tem navegação e pesquisa próprias; filtros combinam sem apagar outros critérios; favoritos/histórico sobrevivem à migração; links antigos continuam funcionando; serviço sobe sem Electron. Publicação não faz parte desta proposta.

## Entrega implementada

- Entrada em `/`, VOD em `/vod` e TV em `/tv`; rotas legadas preservadas.
- `src/modules/vod`: componentes, tipos, API, hook de pesquisa e histórico, telas de detalhe/player extraídas do componente principal.
- `src/modules/tv`: aplicação React, normalização/pesquisa de canais e favoritos com a chave de armazenamento anterior.
- `src/shared/lib`: HTTP com cancelamento e pesquisa sem distinção de acentos.
- TV combina nome, categoria, favoritos e ordem, sem trocar o canal enquanto se pesquisa. Em erro da origem, mantém os favoritos salvos acessíveis.
- VOD adiciona tipo, nota mínima, ordenação e paginação. O servidor valida ano, página e nota. A pesquisa por nome usa páginas remotas; filtros complementares refinam a página carregada, explicitamente indicado na interface.
- `npm start` inicia a experiência web. Electron continua disponível por `npm run start:desktop`.
- Os quatro erros de tipagem iniciais foram corrigidos. Também foram corrigidas referências ausentes usadas em links diretos e filmografia.
- Histórico e favoritos continuam locais ao navegador. Não foi introduzida autenticação de usuários nem sincronização entre dispositivos.
- Configurações administrativas e restrições das origens de vídeo não foram reestruturadas nesta entrega. Nenhum deploy ou push realizado.

### Validação final

- TypeScript: aprovado.
- Build Vite: aprovado, com entradas separadas `home.js`, `app.js` e `tv.js`.
- Testes Go: aprovados, incluindo rotas novas/legadas e validação de parâmetros.
- Testes de pesquisa: aprovados para combinações de filtros, acentos, favoritos, normalização e ordenação.
- Prévia local: `http://localhost:38765/`, iniciada sem Electron; TV carregou 308 canais e VOD exibiu dados/imagens reais na inspeção.
- Não foi executada uma suíte visual responsiva nem validada a transmissão ponta a ponta de todos os provedores.
