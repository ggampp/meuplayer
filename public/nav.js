(function () {
  const LINKS = [
    { label: 'Filmes', path: '/filme' },
    { label: 'Séries', path: '/serie' },
    { label: 'Animes', path: '/anime' },
    { label: 'Doramas', path: '/dorama' },
    { label: 'Canais', path: '/canais' },
    { label: 'Rede Buzz', path: '/rede-buzz' },
    { label: 'Buzz Favoritos', path: '/rede-buzz-favoritos' },
    { label: 'Configurações', path: '/configuracoes' },
  ];

  const CATALOG_LIST_PATHS = new Set(['/', '/filme', '/serie', '/anime', '/dorama']);

  const style = document.createElement('style');
  style.textContent = `
    .app-nav {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2xs) var(--space-sm);
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
      font-weight: 400;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
      color: var(--color-ink);
      text-decoration: none;
      margin-right: var(--space-md);
      padding: var(--space-3xs) var(--space-2xs);
    }
    .app-nav__logo:hover {
      color: var(--color-accent);
    }
    .app-nav__link {
      font-family: var(--font-body);
      font-size: 0.85rem;
      letter-spacing: 0.02em;
      color: var(--color-ink-2);
      text-decoration: none;
      padding: 0.4rem 0.85rem;
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
      flex: 1 1 280px;
      justify-content: flex-end;
      margin-left: auto;
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
    @media (max-width: 640px) {
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
        justify-content: stretch;
      }
    }
  `;
  document.head.appendChild(style);

  const currentPath = window.location.pathname;

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

  LINKS.forEach(({ label, path: linkPath }) => {
    const a = document.createElement('a');
    a.className = 'app-nav__link' + (isActive(linkPath) ? ' app-nav__link--active' : '');
    a.href = linkPath;
    a.textContent = label;
    nav.appendChild(a);
  });

  if (isCatalogListPage()) {
    const filtersSlot = document.createElement('div');
    filtersSlot.id = 'catalogFilters';
    filtersSlot.className = 'app-nav__filters';
    filtersSlot.setAttribute('aria-label', 'Filtros do catálogo');
    nav.appendChild(filtersSlot);
  }

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
