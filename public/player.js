(function () {
  const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  const params = new URLSearchParams(window.location.search);
  let targetUrl = params.get('url') || 'https://www.hbomax.com/br/pt';
  let targetName = params.get('name') || '';
  let targetIcon = params.get('icon') || '';
  const providerId = params.get('providerId') || '';

  const badgeIcon = document.getElementById('playerBadgeIcon');
  const badgeName = document.getElementById('playerBadgeName');
  const btnBack = document.getElementById('btnBack');
  const btnForward = document.getElementById('btnForward');
  const btnReload = document.getElementById('btnReload');
  const btnHome = document.getElementById('btnHome');
  const btnOpenExternal = document.getElementById('btnOpenExternal');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const viewport = document.getElementById('playerViewport');
  const loading = document.getElementById('playerLoading');
  const loadingText = document.getElementById('playerLoadingText');

  let activeEmbed = null;

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
          match = providers.find((p) => p.url === targetUrl || targetUrl.includes(p.url));
        }
        if (match) {
          targetName = match.name;
          targetIcon = match.icon;
          targetUrl = match.url;
        }
      }
    } catch (e) {
      console.warn('Could not fetch providers metadata:', e);
    }

    if (!targetName) {
      try {
        const hostname = new URL(targetUrl).hostname.replace('www.', '');
        targetName = hostname.charAt(0).toUpperCase() + hostname.slice(1);
      } catch {
        targetName = 'Plataforma';
      }
    }

    if (!targetIcon) {
      targetIcon = '/img/providers/default-provider.svg';
    }

    badgeName.textContent = targetName;
    badgeIcon.src = targetIcon;
    document.title = `MeuPlayer · ${targetName}`;
    urlInput.value = targetUrl;
  }

  function initPlayer() {
    const isElectron = window.__MEUPLAYER_ENV && window.__MEUPLAYER_ENV.isElectron;

    if (isElectron) {
      const webview = document.createElement('webview');
      webview.id = 'superWebview';
      webview.setAttribute('src', targetUrl);
      webview.setAttribute('allowpopups', 'true');
      webview.setAttribute('useragent', DEFAULT_USER_AGENT);
      webview.style.width = '100%';
      webview.style.height = '100%';

      webview.addEventListener('did-start-loading', () => {
        loading.classList.remove('hidden');
        loadingText.textContent = `Carregando ${targetName}...`;
      });

      webview.addEventListener('did-stop-loading', () => {
        loading.classList.add('hidden');
        urlInput.value = webview.getURL() || targetUrl;
      });

      webview.addEventListener('did-navigate', (e) => {
        urlInput.value = e.url;
      });

      webview.addEventListener('did-navigate-in-page', (e) => {
        urlInput.value = e.url;
      });

      webview.addEventListener('dom-ready', () => {
        loading.classList.add('hidden');
      });

      viewport.appendChild(webview);
      activeEmbed = webview;
    } else {
      const iframe = document.createElement('iframe');
      iframe.id = 'superIframe';
      iframe.src = targetUrl;
      iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

      iframe.addEventListener('load', () => {
        loading.classList.add('hidden');
      });

      viewport.appendChild(iframe);
      activeEmbed = iframe;
      setTimeout(() => loading.classList.add('hidden'), 1500);
    }
  }

  // Event Listeners dos botões de controle
  btnBack.addEventListener('click', () => {
    if (activeEmbed && typeof activeEmbed.goBack === 'function' && activeEmbed.canGoBack()) {
      activeEmbed.goBack();
    } else {
      window.history.back();
    }
  });

  btnForward.addEventListener('click', () => {
    if (activeEmbed && typeof activeEmbed.goForward === 'function' && activeEmbed.canGoForward()) {
      activeEmbed.goForward();
    }
  });

  btnReload.addEventListener('click', () => {
    if (activeEmbed && typeof activeEmbed.reload === 'function') {
      activeEmbed.reload();
    } else if (activeEmbed) {
      activeEmbed.src = activeEmbed.src;
    }
  });

  btnHome.addEventListener('click', () => {
    window.location.href = '/';
  });

  btnOpenExternal.addEventListener('click', () => {
    const currentUrl = urlInput.value || targetUrl;
    window.open(currentUrl, '_blank');
  });

  btnFullscreen.addEventListener('click', () => {
    const container = document.querySelector('.super-player-container');
    if (!document.fullscreenElement) {
      if (container.requestFullscreen) container.requestFullscreen();
      else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  });

  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let url = urlInput.value.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    targetUrl = url;
    if (activeEmbed && typeof activeEmbed.loadURL === 'function') {
      activeEmbed.loadURL(url);
    } else if (activeEmbed) {
      activeEmbed.src = url;
    }
  });

  loadProviderMetadata().then(() => {
    initPlayer();
  });
})();
