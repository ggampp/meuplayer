(function () {
  function injectIcons() {
    if (document.querySelector('link[rel="icon"][href="/favicon.ico"]')) return;
    const specs = [
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', href: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'icon', href: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ];
    specs.forEach(({ rel, href, type, sizes }) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      if (type) link.type = type;
      if (sizes) link.sizes = sizes;
      document.head.appendChild(link);
    });
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#0d0d1a';
      document.head.appendChild(meta);
    }
  }

  injectIcons();

  const LINKS = [
    { label: 'Filmes', path: '/filme' },
    { label: 'Séries', path: '/serie' },
    { label: 'Animes', path: '/anime' },
    { label: 'Doramas', path: '/dorama' },
    { label: 'TV', path: '/rede-buzz' },
    { label: 'TV Favoritos', path: '/rede-buzz-favoritos' },
    { label: 'Downloads', path: '/downloads' },
    { label: 'Configurações', path: '/configuracoes' },
  ];

  const CATALOG_LIST_PATHS = new Set(['/', '/filme', '/serie', '/anime', '/dorama', '/netflix']);

  const DEFAULT_PROVIDERS = [
    {
      id: 'max',
      name: 'Max',
      url: 'https://www.hbomax.com/br/pt',
      icon: '/img/providers/max.svg',
    },
    {
      id: 'netflix',
      name: 'Netflix',
      url: 'https://www.netflix.com/browse',
      icon: '/img/providers/netflix.svg',
    },
    {
      id: 'recordplus',
      name: 'Record Plus',
      url: 'https://www.recordplus.com/Live/LiveEvent/180?groupId=7',
      icon: '/img/providers/recordplus.svg',
    },
    {
      id: 'primevideo',
      name: 'Prime Video',
      url: 'https://www.primevideo.com/region/na/storefront',
      icon: '/img/providers/primevideo.svg',
    },
  ];

  const style = document.createElement('style');
  style.textContent = `
    .app-nav {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2xs) var(--space-xs);
      padding: var(--space-2xs) var(--space-md);
      min-height: 52px;
      background: oklch(16% 0.02 250 / 0.92);
      border-bottom: 1px solid var(--color-rule);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      flex-shrink: 0;
      font-family: var(--font-body);
    }
    .app-nav__logo {
      font-family: var(--font-display);
      font-style: italic;
      font-weight: 600;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
      color: var(--color-ink);
      text-decoration: none;
      margin-right: var(--space-xs);
      padding: var(--space-3xs) var(--space-2xs);
    }
    .app-nav__logo:hover {
      color: var(--color-accent);
    }

    .app-nav__providers {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      overflow-x: auto;
      padding: 2px 0;
      scrollbar-width: none;
      -ms-overflow-style: none;
      margin-right: auto;
    }
    .app-nav__providers::-webkit-scrollbar {
      display: none;
    }
    .app-nav__provider-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.65rem;
      height: 30px;
      border-radius: 999px;
      background: oklch(22% 0.02 250);
      border: 1px solid var(--color-rule);
      color: var(--color-ink-2);
      text-decoration: none;
      font-size: 0.78rem;
      font-weight: 500;
      white-space: nowrap;
      transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .app-nav__provider-chip:hover {
      background: oklch(28% 0.02 250);
      border-color: var(--color-accent);
      color: var(--color-ink);
      transform: translateY(-1px);
    }
    .app-nav__provider-chip--active {
      background: var(--color-accent);
      color: var(--color-accent-ink);
      border-color: var(--color-accent);
      font-weight: 700;
    }
    .app-nav__provider-chip img {
      height: 16px;
      width: auto;
      max-width: 45px;
      object-fit: contain;
      border-radius: 2px;
    }
    .app-nav__add-provider-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.65rem;
      height: 30px;
      border-radius: 999px;
      background: transparent;
      border: 1px dashed var(--color-accent);
      color: var(--color-accent);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .app-nav__add-provider-btn:hover {
      background: var(--color-accent-soft);
      transform: translateY(-1px);
    }

    .app-nav__link {
      font-family: var(--font-body);
      font-size: 0.82rem;
      letter-spacing: 0.02em;
      color: var(--color-ink-2);
      text-decoration: none;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      transition: color var(--dur-short, 220ms) cubic-bezier(0.16, 1, 0.3, 1),
        background-color var(--dur-short, 220ms) cubic-bezier(0.16, 1, 0.3, 1);
    }
    .app-nav__link:hover {
      color: var(--color-ink);
      background: oklch(28% 0.015 250 / 0.6);
    }
    .app-nav__link--active {
      color: var(--color-accent-ink);
      background: var(--color-accent);
    }
    .app-nav__link:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    .app-nav__filters {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      flex: 0 0 auto;
      justify-content: flex-start;
      margin-left: 0;
      min-width: 0;
    }
    .app-nav__filters:empty {
      display: none;
    }
    .app-nav__mobile-select {
      display: none;
      font-family: var(--font-body);
      font-size: 0.85rem;
      color: var(--color-ink);
      background: var(--color-paper-2);
      border: 1px solid var(--color-rule);
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      cursor: pointer;
      min-width: 8rem;
    }
    @media (max-width: 768px) {
      .app-nav__link {
        display: none;
      }
      .app-nav__mobile-select {
        display: block;
      }
      .app-nav {
        padding: var(--space-2xs) var(--space-sm) var(--space-xs);
      }
      .app-nav__filters {
        flex: 1 1 100%;
        order: 10;
        margin-left: 0;
        margin-right: 0;
        justify-content: stretch;
      }
    }
  `;
  document.head.appendChild(style);

  const currentPath = window.location.pathname;
  const currentParams = new URLSearchParams(window.location.search);
  const activePlayerUrl = currentParams.get('url') || '';

  function isCatalogListPage() {
    const path = currentPath.replace(/\/$/, '') || '/';
    return CATALOG_LIST_PATHS.has(path);
  }

  function isActive(linkPath) {
    if (linkPath === '/') return currentPath === '/';
    return currentPath === linkPath || currentPath.startsWith(linkPath + '/');
  }

  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Navegação principal');

  const logo = document.createElement('a');
  logo.className = 'app-nav__logo';
  logo.href = '/';
  logo.textContent = 'MeuPlayer';
  nav.appendChild(logo);

  // Container para chips dos Provedores (Super Player)
  const providersContainer = document.createElement('div');
  providersContainer.className = 'app-nav__providers';
  providersContainer.setAttribute('aria-label', 'Plataformas de Vídeo');
  nav.appendChild(providersContainer);

  async function renderProviders() {
    let providers = DEFAULT_PROVIDERS;
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        providers = await res.json();
      }
    } catch (e) {
      console.warn('Usando provedores padrão para navegação:', e);
    }

    providersContainer.innerHTML = '';

    providers.forEach((provider) => {
      const chip = document.createElement('a');
      const playerLink = '/player?url=' + encodeURIComponent(provider.url) + '&name=' + encodeURIComponent(provider.name) + '&icon=' + encodeURIComponent(provider.icon);
      
      const isCurrentActive = currentPath === '/player' && (activePlayerUrl === provider.url || activePlayerUrl.includes(provider.url));
      chip.className = 'app-nav__provider-chip' + (isCurrentActive ? ' app-nav__provider-chip--active' : '');
      chip.href = playerLink;
      chip.title = `Abrir ${provider.name} no Super Player`;

      const img = document.createElement('img');
      img.src = provider.icon || '/img/providers/default-provider.svg';
      img.alt = provider.name;
      img.onerror = () => { img.src = '/img/providers/default-provider.svg'; };

      const span = document.createElement('span');
      span.textContent = provider.name;

      chip.appendChild(img);
      chip.appendChild(span);
      providersContainer.appendChild(chip);
    });

    // Botão "+ Novo Provedor"
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'app-nav__add-provider-btn';
    addBtn.innerHTML = '<span>+ Novo Provedor</span>';
    addBtn.title = 'Cadastrar nova plataforma de vídeo';

    addBtn.addEventListener('click', () => {
      if (window.MeuPlayerProviderModal) {
        window.MeuPlayerProviderModal.open();
      } else {
        const script = document.createElement('script');
        script.src = '/provider-modal.js';
        script.onload = () => {
          if (window.MeuPlayerProviderModal) {
            window.MeuPlayerProviderModal.open();
          }
        };
        document.body.appendChild(script);
      }
    });

    providersContainer.appendChild(addBtn);
  }

  renderProviders();
  window.addEventListener('meuplayer:providers-changed', renderProviders);

  const mobileNav = document.createElement('select');
  mobileNav.className = 'app-nav__mobile-select';
  mobileNav.setAttribute('aria-label', 'Navegação');
  LINKS.forEach(({ label, path: linkPath }) => {
    const opt = document.createElement('option');
    opt.value = linkPath;
    opt.textContent = label;
    if (isActive(linkPath)) opt.selected = true;
    mobileNav.appendChild(opt);
  });
  mobileNav.addEventListener('change', () => {
    window.location.href = mobileNav.value;
  });
  nav.appendChild(mobileNav);

  if (isCatalogListPage()) {
    const filtersSlot = document.createElement('div');
    filtersSlot.id = 'catalogFilters';
    filtersSlot.className = 'app-nav__filters';
    filtersSlot.setAttribute('aria-label', 'Filtros do catálogo');
    nav.appendChild(filtersSlot);
  }

  LINKS.forEach(({ label, path: linkPath }) => {
    const a = document.createElement('a');
    a.className = 'app-nav__link' + (isActive(linkPath) ? ' app-nav__link--active' : '');
    a.href = linkPath;
    a.textContent = label;
    nav.appendChild(a);
  });

  function inject() {
    document.body.insertBefore(nav, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  // ── Remote receiver ───────────────────────────────────────────────
  (function () {
    const SESSION_KEY = 'meuplayer_remote_session';
    let evtSource = null;

    function handleCommand(cmd) {
      const action = String(cmd.action || '');
      const value = String(cmd.value || '');
      if (action === 'navigate' && value.startsWith('/')) {
        window.location.href = value;
      } else if (action === 'search') {
        window.dispatchEvent(new CustomEvent('meuplayer:remote-search', { detail: { term: value } }));
      } else if (action === 'channel_up') {
        if (typeof window.meuPlayerSelectAdjacentChannel === 'function') {
          window.meuPlayerSelectAdjacentChannel(-1);
        }
      } else if (action === 'channel_down') {
        if (typeof window.meuPlayerSelectAdjacentChannel === 'function') {
          window.meuPlayerSelectAdjacentChannel(1);
        }
      } else if (action.startsWith('key_')) {
        const keyMap = {
          'key_up': 'ArrowUp',
          'key_down': 'ArrowDown',
          'key_left': 'ArrowLeft',
          'key_right': 'ArrowRight',
          'key_ok': 'Enter',
          'key_back': 'Escape'
        };
        const mappedKey = keyMap[action];
        if (mappedKey) {
          const event = new KeyboardEvent('keydown', {
            key: mappedKey,
            bubbles: true,
            cancelable: true
          });
          window.dispatchEvent(event);
        }
      }
    }

    function connect(token) {
      if (evtSource) { evtSource.close(); evtSource = null; }
      const url = '/api/remote/events?session=' + encodeURIComponent(token);
      evtSource = new EventSource(url);
      evtSource.onmessage = function (event) {
        try { handleCommand(JSON.parse(event.data)); } catch (e) {}
      };
      evtSource.onerror = function () {
        evtSource.close();
        evtSource = null;
        setTimeout(function () { connect(token); }, 5000);
      };
    }

    const storedToken = localStorage.getItem(SESSION_KEY);
    if (storedToken) connect(storedToken);

    window.addEventListener('meuplayer:remote-session-ready', function (e) {
      const token = e.detail && e.detail.token;
      if (token) {
        localStorage.setItem(SESSION_KEY, token);
        connect(token);
      }
    });
  })();
})();
