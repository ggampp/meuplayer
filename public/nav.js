/**
 * MeuPlayer — Platform Hub navigation
 * Primary rail: native platforms (MeuPlayer, TV) + external streamings
 * Secondary row: contextual sub-nav (catalog or TV sections)
 */
(function () {
  'use strict';

  // Purge legacy SW shell caches that used to pin old flat nav (Filmes/Séries/TV…)
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => {
      keys
        .filter((k) => k.startsWith('meuplayer-shell-') && k !== 'meuplayer-shell-v3-hub')
        .forEach((k) => caches.delete(k));
    });
  }

  // ── Config ─────────────────────────────────────────────────────────
  const NATIVE_PLATFORMS = [
    {
      id: 'meuplayer',
      name: 'MeuPlayer',
      path: '/',
      title: 'Catálogo MeuPlayer — filmes, séries, animes e doramas',
      icon: 'film',
    },
    {
      id: 'tv',
      name: 'TV',
      path: '/rede-buzz',
      title: 'TV ao vivo',
      icon: 'tv',
      live: true,
    },
  ];

  const CATALOG_LINKS = [
    { label: 'Início', path: '/' },
    { label: 'Filmes', path: '/filme' },
    { label: 'Séries', path: '/serie' },
    { label: 'Animes', path: '/anime' },
    { label: 'Doramas', path: '/dorama' },
    { label: 'Fileiras', path: '/netflix' },
  ];

  const TV_LINKS = [
    { label: 'Canais', path: '/rede-buzz' },
    { label: 'Favoritos', path: '/rede-buzz-favoritos' },
  ];

  const UTILITY_LINKS = [
    { label: 'Downloads', path: '/downloads', icon: 'download' },
    { label: 'Config', path: '/configuracoes', icon: 'settings' },
  ];

  const CATALOG_LIST_PATHS = new Set(['/', '/filme', '/serie', '/anime', '/dorama', '/netflix']);
  const CATALOG_PREFIXES = ['/filme', '/serie', '/anime', '/dorama', '/netflix'];
  const TV_PREFIXES = ['/rede-buzz', '/canais'];

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

  const ICONS = {
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  // ── Route helpers ──────────────────────────────────────────────────
  const currentPath = normalizePath(window.location.pathname);
  const currentParams = new URLSearchParams(window.location.search);
  const activePlayerUrl = currentParams.get('url') || '';
  const activeProviderId = currentParams.get('providerId') || '';

  function normalizePath(path) {
    return (path || '/').replace(/\/$/, '') || '/';
  }

  function isCatalogListPage() {
    return CATALOG_LIST_PATHS.has(currentPath);
  }

  function isMeuPlayerActive() {
    if (currentPath === '/') return true;
    return CATALOG_PREFIXES.some((p) => currentPath === p || currentPath.startsWith(p + '/'));
  }

  function isTvActive() {
    return TV_PREFIXES.some((p) => currentPath === p || currentPath.startsWith(p + '/'));
  }

  function isExternalPlayerActive() {
    return currentPath === '/player';
  }

  function isLinkActive(linkPath) {
    const normalized = normalizePath(linkPath);
    if (normalized === '/') return currentPath === '/';
    return currentPath === normalized || currentPath.startsWith(normalized + '/');
  }

  function isNativeActive(platform) {
    if (platform.id === 'meuplayer') return isMeuPlayerActive();
    if (platform.id === 'tv') return isTvActive();
    return false;
  }

  function isExternalProviderActive(provider) {
    if (!isExternalPlayerActive()) return false;
    if (activeProviderId && provider.id && activeProviderId === provider.id) return true;
    if (!activePlayerUrl || !provider.url) return false;
    return (
      activePlayerUrl === provider.url ||
      activePlayerUrl.includes(provider.url) ||
      provider.url.includes(activePlayerUrl)
    );
  }

  function playerHref(provider) {
    const q = new URLSearchParams();
    q.set('url', provider.url || '');
    q.set('name', provider.name || '');
    if (provider.icon) q.set('icon', provider.icon);
    if (provider.id) q.set('providerId', provider.id);
    return '/player?' + q.toString();
  }

  // ── DOM helpers ────────────────────────────────────────────────────
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((key) => {
        const val = props[key];
        if (val == null || val === false) return;
        if (key === 'className') node.className = val;
        else if (key === 'dataset') Object.assign(node.dataset, val);
        else if (key === 'html') node.innerHTML = val;
        else if (key.startsWith('on') && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key === 'attrs') {
          Object.keys(val).forEach((a) => node.setAttribute(a, val[a]));
        } else {
          node.setAttribute(key, val === true ? '' : String(val));
        }
      });
    }
    children.flat().forEach((child) => {
      if (child == null || child === false) return;
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    });
    return node;
  }

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

  function ensureHubStylesheet() {
    if (document.querySelector('link[href="/css/hub.css"]')) return;
    // Prefer styles.css import chain; fallback inject if styles not loaded yet
    if (document.querySelector('link[href="/styles.css"], link[href*="styles.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/hub.css';
    document.head.appendChild(link);
  }

  function openProviderModal() {
    if (window.MeuPlayerProviderModal) {
      window.MeuPlayerProviderModal.open();
      return;
    }
    const script = document.createElement('script');
    script.src = '/provider-modal.js';
    script.onload = () => {
      if (window.MeuPlayerProviderModal) window.MeuPlayerProviderModal.open();
    };
    document.body.appendChild(script);
  }

  // ── Build chips ────────────────────────────────────────────────────
  function buildNativeChip(platform) {
    const active = isNativeActive(platform);
    const classes = [
      'app-nav__chip',
      'app-nav__chip--native',
      active ? 'app-nav__chip--active' : '',
      platform.live && active ? 'app-nav__chip--live' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const chip = el('a', {
      className: classes,
      href: platform.path,
      title: platform.title,
      'aria-current': active ? 'page' : null,
    });

    if (platform.icon && ICONS[platform.icon]) {
      chip.appendChild(
        el('span', { className: 'app-nav__chip-icon', html: ICONS[platform.icon] })
      );
    }
    chip.appendChild(document.createTextNode(platform.name));
    return chip;
  }

  function buildExternalChip(provider) {
    const active = isExternalProviderActive(provider);
    const chip = el('a', {
      className: 'app-nav__chip' + (active ? ' app-nav__chip--active' : ''),
      href: playerHref(provider),
      title: 'Abrir ' + provider.name,
      'aria-current': active ? 'page' : null,
    });

    if (provider.icon) {
      const img = el('img', {
        src: provider.icon,
        alt: '',
      });
      img.onerror = () => {
        img.src = '/img/providers/default-provider.svg';
      };
      chip.appendChild(img);
    }
    chip.appendChild(el('span', null, provider.name));
    return chip;
  }

  function buildAddButton() {
    return el(
      'button',
      {
        type: 'button',
        className: 'app-nav__add',
        title: 'Cadastrar nova plataforma de vídeo',
        onClick: openProviderModal,
      },
      el('span', { className: 'app-nav__add-icon', html: '+' }),
      el('span', null, 'Novo')
    );
  }

  function fillSelect(select, options, isSelected) {
    select.innerHTML = '';
    options.forEach((opt) => {
      const option = el('option', { value: opt.value }, opt.label);
      if (isSelected(opt)) option.selected = true;
      select.appendChild(option);
    });
  }

  // ── Render platforms ───────────────────────────────────────────────
  function createHub() {
    injectIcons();
    ensureHubStylesheet();

    const nav = el('nav', {
      className: 'app-nav',
      attrs: { 'aria-label': 'Hub de plataformas' },
    });

    const primaryRow = el('div', { className: 'app-nav__row app-nav__row--primary' });
    nav.appendChild(primaryRow);

    primaryRow.appendChild(
      el(
        'a',
        {
          className: 'app-nav__logo',
          href: '/',
          title: 'MeuPlayer — catálogo',
        },
        'MeuPlayer'
      )
    );

    const platformsContainer = el('div', {
      className: 'app-nav__platforms',
      attrs: {
        'aria-label': 'Plataformas de vídeo',
        role: 'navigation',
      },
    });
    primaryRow.appendChild(platformsContainer);

    const platformSelect = el('select', {
      className: 'app-nav__mobile-select',
      attrs: { 'aria-label': 'Plataforma' },
      onChange: () => {
        window.location.href = platformSelect.value;
      },
    });
    primaryRow.appendChild(platformSelect);

    const utilities = el('div', { className: 'app-nav__utilities' });
    UTILITY_LINKS.forEach(({ label, path, icon }) => {
      const active = isLinkActive(path);
      const link = el('a', {
        className: 'app-nav__util' + (active ? ' app-nav__util--active' : ''),
        href: path,
        title: label,
        'aria-current': active ? 'page' : null,
      });
      if (icon && ICONS[icon]) {
        link.insertAdjacentHTML('beforeend', ICONS[icon]);
      }
      link.appendChild(el('span', { className: 'app-nav__util-label' }, label));
      utilities.appendChild(link);
    });
    primaryRow.appendChild(utilities);

    // Secondary contextual row
    const showMeuPlayerSub = isMeuPlayerActive();
    const showTvSub = isTvActive();

    if (showMeuPlayerSub || showTvSub) {
      const secondaryRow = el('div', { className: 'app-nav__row app-nav__row--secondary' });
      nav.appendChild(secondaryRow);

      const links = showMeuPlayerSub ? CATALOG_LINKS : TV_LINKS;
      const subnav = el('div', {
        className: 'app-nav__subnav',
        attrs: {
          'aria-label': showMeuPlayerSub ? 'Seções do catálogo' : 'Seções da TV',
        },
      });

      links.forEach(({ label, path }) => {
        const active = isLinkActive(path);
        subnav.appendChild(
          el(
            'a',
            {
              className: 'app-nav__link' + (active ? ' app-nav__link--active' : ''),
              href: path,
              'aria-current': active ? 'page' : null,
            },
            label
          )
        );
      });
      secondaryRow.appendChild(subnav);

      const sectionSelect = el('select', {
        className: 'app-nav__mobile-select',
        attrs: { 'aria-label': 'Seção' },
        onChange: () => {
          window.location.href = sectionSelect.value;
        },
      });
      fillSelect(
        sectionSelect,
        links.map((l) => ({ value: l.path, label: l.label })),
        (opt) => isLinkActive(opt.value)
      );
      secondaryRow.appendChild(sectionSelect);

      if (showMeuPlayerSub && isCatalogListPage()) {
        secondaryRow.appendChild(
          el('div', {
            id: 'catalogFilters',
            className: 'app-nav__filters',
            attrs: { 'aria-label': 'Filtros do catálogo' },
          })
        );
      }
    }

    function renderPlatformsSync(externalProviders) {
      platformsContainer.innerHTML = '';

      const selectOptions = [];

      NATIVE_PLATFORMS.forEach((platform) => {
        platformsContainer.appendChild(buildNativeChip(platform));
        selectOptions.push({
          value: platform.path,
          label: platform.name,
          selected: isNativeActive(platform),
        });
      });

      platformsContainer.appendChild(el('span', { className: 'app-nav__divider', attrs: { 'aria-hidden': 'true' } }));

      (externalProviders || []).forEach((provider) => {
        platformsContainer.appendChild(buildExternalChip(provider));
        selectOptions.push({
          value: playerHref(provider),
          label: provider.name,
          selected: isExternalProviderActive(provider),
        });
      });

      platformsContainer.appendChild(buildAddButton());

      fillSelect(platformSelect, selectOptions, (opt) => opt.selected);
    }

    async function loadPlatforms() {
      try {
        const res = await fetch('/api/providers');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            renderPlatformsSync(list);
            publishNavOffset();
            return;
          }
        }
      } catch (e) {
        console.warn('Usando plataformas padrão para navegação:', e);
      }
      renderPlatformsSync(DEFAULT_PROVIDERS);
      publishNavOffset();
    }

    function publishNavOffset() {
      const h = Math.ceil(nav.getBoundingClientRect().height) || 56;
      document.documentElement.style.setProperty('--app-nav-offset', h + 'px');
    }

    // Initial paint + API refresh
    renderPlatformsSync(DEFAULT_PROVIDERS);
    loadPlatforms();
    window.addEventListener('meuplayer:providers-changed', loadPlatforms);

    function inject() {
      document.body.insertBefore(nav, document.body.firstChild);
      publishNavOffset();
      window.addEventListener('resize', publishNavOffset);
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(publishNavOffset);
        ro.observe(nav);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  }

  // ── Remote receiver (SSE) ──────────────────────────────────────────
  function initRemoteReceiver() {
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
          key_up: 'ArrowUp',
          key_down: 'ArrowDown',
          key_left: 'ArrowLeft',
          key_right: 'ArrowRight',
          key_ok: 'Enter',
          key_back: 'Escape',
        };
        const mappedKey = keyMap[action];
        if (mappedKey) {
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: mappedKey, bubbles: true, cancelable: true })
          );
        }
      }
    }

    function connect(token) {
      if (evtSource) {
        evtSource.close();
        evtSource = null;
      }
      evtSource = new EventSource('/api/remote/events?session=' + encodeURIComponent(token));
      evtSource.onmessage = function (event) {
        try {
          handleCommand(JSON.parse(event.data));
        } catch (_) {}
      };
      evtSource.onerror = function () {
        evtSource.close();
        evtSource = null;
        setTimeout(function () {
          connect(token);
        }, 5000);
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
  }

  createHub();
  initRemoteReceiver();
})();
