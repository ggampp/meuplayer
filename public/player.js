/**
 * MeuPlayer — Super Player host for external streaming platforms
 * Electron: <webview> with persistent partition · Browser: iframe + fallback
 */
(function () {
  'use strict';

  // Keep UA close to Electron 35 / Chromium 134 so sites don't fingerprint as bots
  const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
  const DEFAULT_URL = 'https://www.hbomax.com/br/pt';
  const STREAMING_PARTITION = 'persist:meuplayer-streaming';

  const params = new URLSearchParams(window.location.search);
  let targetUrl = params.get('url') || DEFAULT_URL;
  let targetName = params.get('name') || '';
  const providerId = params.get('providerId') || '';

  const ui = {
    back: document.getElementById('btnBack'),
    forward: document.getElementById('btnForward'),
    reload: document.getElementById('btnReload'),
    home: document.getElementById('btnHome'),
    openExternal: document.getElementById('btnOpenExternal'),
    fullscreen: document.getElementById('btnFullscreen'),
    viewport: document.getElementById('playerViewport'),
    loading: document.getElementById('playerLoading'),
    loadingText: document.getElementById('playerLoadingText'),
    title: document.getElementById('playerTitle'),
    shell: document.getElementById('superPlayer'),
  };

  let activeEmbed = null;

  function isElectron() {
    return !!(window.__MEUPLAYER_ENV && window.__MEUPLAYER_ENV.isElectron);
  }

  function setLoading(visible, message) {
    if (!ui.loading) return;
    if (message && ui.loadingText) ui.loadingText.textContent = message;
    ui.loading.classList.toggle('hidden', !visible);
  }

  function setPlatformTitle(name) {
    document.title = 'MeuPlayer · ' + name;
    if (ui.title) ui.title.textContent = name;
    if (ui.loadingText) ui.loadingText.textContent = 'Carregando ' + name + '…';
  }

  function hostnameFallback(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return host.charAt(0).toUpperCase() + host.slice(1);
    } catch {
      return 'Plataforma';
    }
  }

  async function loadProviderMetadata() {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const providers = await res.json();
        let match = null;
        if (providerId) {
          match = providers.find((p) => p.id === providerId);
        }
        if (!match && targetUrl) {
          match = providers.find(
            (p) =>
              p.url === targetUrl ||
              targetUrl.includes(p.url) ||
              (p.url && p.url.includes(targetUrl))
          );
        }
        if (match) {
          targetName = match.name;
          targetUrl = match.url;
        }
      }
    } catch (e) {
      console.warn('Could not fetch providers metadata:', e);
    }

    if (!targetName) targetName = hostnameFallback(targetUrl);
    setPlatformTitle(targetName);
  }

  function styleEmbed(node) {
    node.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#000;';
  }

  function clearViewport() {
    if (!ui.viewport) return;
    Array.from(ui.viewport.children).forEach((child) => {
      if (child.id === 'playerLoading') return;
      child.remove();
    });
  }

  function showEmbedFallback(reason) {
    clearViewport();
    setLoading(false);
    const box = document.createElement('div');
    box.className = 'player-fallback';
    box.innerHTML =
      '<div class="player-fallback__card">' +
      '<p class="player-fallback__eyebrow">Streaming</p>' +
      '<h2 class="player-fallback__title">' +
      escapeHtml(targetName || 'Plataforma') +
      '</h2>' +
      '<p class="player-fallback__text">' +
      escapeHtml(reason) +
      '</p>' +
      '<div class="player-fallback__actions">' +
      '<button type="button" class="player-fallback__btn player-fallback__btn--primary" id="fallbackOpen">Abrir no navegador</button>' +
      '<button type="button" class="player-fallback__btn" id="fallbackRetry">Tentar de novo</button>' +
      '</div></div>';
    ui.viewport.appendChild(box);
    const openBtn = box.querySelector('#fallbackOpen');
    const retryBtn = box.querySelector('#fallbackRetry');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      });
    }
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        box.remove();
        initPlayer();
      });
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function createWebview() {
    clearViewport();
    setLoading(true, 'Carregando ' + targetName + '…');

    const webview = document.createElement('webview');
    webview.id = 'superWebview';
    // Persistent cookies/login across platform switches & app restarts
    webview.setAttribute('partition', STREAMING_PARTITION);
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('useragent', DEFAULT_USER_AGENT);
    // nativeWindowOpen so OAuth/login popups work with main.js policy
    webview.setAttribute(
      'webpreferences',
      [
        'nativeWindowOpen=yes',
        'contextIsolation=yes',
        'javascript=yes',
        'plugins=yes',
        'webSecurity=yes',
      ].join(', ')
    );
    styleEmbed(webview);

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setLoading(false);
    };

    webview.addEventListener('did-start-loading', () => {
      settled = false;
      setLoading(true, 'Carregando ' + targetName + '…');
    });
    webview.addEventListener('did-stop-loading', settle);
    webview.addEventListener('dom-ready', settle);
    webview.addEventListener('did-fail-load', (e) => {
      // Ignore aborted navigations (user clicked another platform, etc.)
      if (e && (e.errorCode === -3 || e.isMainFrame === false)) return;
      console.warn('[player] did-fail-load', e && e.errorCode, e && e.errorDescription);
      settle();
      if (e && e.isMainFrame) {
        showEmbedFallback(
          'Não foi possível carregar esta plataforma (' +
            (e.errorDescription || 'erro de rede') +
            '). Tente de novo ou abra no navegador.'
        );
      }
    });

    // Some sites open login in a new window — main.js allows webview popups.
    // If a site fires the legacy new-window event, load in-place as fallback.
    webview.addEventListener('new-window', (e) => {
      const url = e.url;
      if (!url || url === 'about:blank') return;
      // Prefer OS/popup window (handled by Electron); only force in-place if needed
      try {
        if (e.preventDefault) e.preventDefault();
      } catch {
        /* Electron may not always support preventDefault */
      }
    });

    // Set src after listeners so we don't miss the first load events
    ui.viewport.appendChild(webview);
    activeEmbed = webview;
    webview.setAttribute('src', targetUrl);

    // Safety: never leave the spinner forever on flaky sites
    setTimeout(settle, 12000);
  }

  function createIframe() {
    clearViewport();
    setLoading(true, 'Carregando ' + targetName + '…');

    const iframe = document.createElement('iframe');
    iframe.id = 'superIframe';
    iframe.title = targetName || 'Plataforma de streaming';
    iframe.allow =
      'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-read; clipboard-write';
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    styleEmbed(iframe);

    let loaded = false;
    iframe.addEventListener('load', () => {
      loaded = true;
      setLoading(false);
      // Many streamers send X-Frame-Options / CSP and the iframe stays blank.
      // After a short delay, if still empty-looking, offer external open.
      setTimeout(() => {
        try {
          // Cross-origin access throws — that's expected when embed works
          const doc = iframe.contentDocument;
          if (doc && (!doc.body || !doc.body.innerHTML.trim())) {
            showEmbedFallback(
              'Esta plataforma bloqueia incorporação no navegador. Use o app Electron ou abra no navegador externo.'
            );
          }
        } catch {
          // Cross-origin: embed may have succeeded — leave it alone
        }
      }, 2500);
    });

    ui.viewport.appendChild(iframe);
    activeEmbed = iframe;
    iframe.src = targetUrl;

    setTimeout(() => {
      if (!loaded) {
        setLoading(false);
        showEmbedFallback(
          'O navegador costuma bloquear Netflix, Max, Prime etc. dentro de iframe. Abra no app desktop (Electron) ou no navegador externo.'
        );
      }
    }, 5000);
  }

  function initPlayer() {
    activeEmbed = null;
    if (isElectron()) createWebview();
    else createIframe();
  }

  function currentEmbedUrl() {
    try {
      if (activeEmbed && typeof activeEmbed.getURL === 'function') {
        return activeEmbed.getURL() || targetUrl;
      }
    } catch {
      /* webview may throw if not ready */
    }
    return targetUrl;
  }

  function bindToolbar() {
    ui.back.addEventListener('click', () => {
      try {
        if (activeEmbed && typeof activeEmbed.goBack === 'function' && activeEmbed.canGoBack()) {
          activeEmbed.goBack();
          return;
        }
      } catch {
        /* ignore */
      }
      window.history.back();
    });

    ui.forward.addEventListener('click', () => {
      try {
        if (
          activeEmbed &&
          typeof activeEmbed.goForward === 'function' &&
          activeEmbed.canGoForward()
        ) {
          activeEmbed.goForward();
        }
      } catch {
        /* ignore */
      }
    });

    ui.reload.addEventListener('click', () => {
      try {
        if (activeEmbed && typeof activeEmbed.reload === 'function') {
          activeEmbed.reload();
          return;
        }
      } catch {
        /* ignore */
      }
      if (activeEmbed && 'src' in activeEmbed) {
        activeEmbed.src = targetUrl;
      }
    });

    ui.home.addEventListener('click', () => {
      window.location.href = '/';
    });

    ui.openExternal.addEventListener('click', () => {
      window.open(currentEmbedUrl(), '_blank', 'noopener,noreferrer');
    });

    ui.fullscreen.addEventListener('click', () => {
      const container = ui.shell || document.documentElement;
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        ui.reload.click();
      } else if (e.key === 'F11') {
        e.preventDefault();
        ui.fullscreen.click();
      }
    });
  }

  bindToolbar();

  // __MEUPLAYER_ENV is injected after did-finish-load; wait a tick so Electron is detected
  function boot() {
    loadProviderMetadata().then(() => {
      // Retry Electron detection once — injection can race with this script
      if (!isElectron() && navigator.userAgent.includes('Electron')) {
        window.__MEUPLAYER_ENV = window.__MEUPLAYER_ENV || {
          isElectron: true,
          platform: 'win32',
          version: '1.1.0',
        };
      }
      initPlayer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // Short delay helps catch late env injection on navigation
    setTimeout(boot, 50);
  }
})();
