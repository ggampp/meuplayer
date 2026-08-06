const { app, BrowserWindow, BrowserView, session, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PORT = 8765;
const STREAM_PARTITION = 'persist:meuplayer-streaming';
let pyProc = null;
let mainWindow = null;
let autoplayTimer = null;
/** @type {BrowserView | null} */
let streamView = null;

function getUserDataPath() {
  return app.getPath('userData');
}

function getSettingsPath() {
  return path.join(getUserDataPath(), 'settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function loadProjectDotEnv() {
  const envPath = path.join(__dirname, '.env');
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // .env opcional em desenvolvimento
  }
}

function getServerLaunch() {
  if (app.isPackaged) {
    const resources = process.resourcesPath;
    const isWin = process.platform === 'win32';
    return {
      command: path.join(resources, isWin ? 'meuplayer-server.exe' : 'meuplayer-server'),
      args: [],
      cwd: resources,
      staticDir: path.join(resources, 'public'),
    };
  }

  return {
    command: 'go',
    args: ['run', './cmd/server'],
    cwd: __dirname,
    staticDir: path.join(__dirname, 'public'),
  };
}

function resolveTmdbApiKey() {
  const settings = loadSettings();
  if (settings.tmdbApiKey && String(settings.tmdbApiKey).trim()) {
    return String(settings.tmdbApiKey).trim();
  }
  if (!app.isPackaged) {
    loadProjectDotEnv();
  }
  if (process.env.TMDB_API_KEY && String(process.env.TMDB_API_KEY).trim()) {
    return String(process.env.TMDB_API_KEY).trim();
  }
  return '';
}

function buildServerEnv() {
  const launch = getServerLaunch();
  const tmdbApiKey = resolveTmdbApiKey();
  const env = {
    ...process.env,
    PORT: String(PORT),
    MEUPLAYER_USER_DATA: getUserDataPath(),
    MEUPLAYER_STATIC_DIR: launch.staticDir,
  };
  if (tmdbApiKey) {
    env.TMDB_API_KEY = tmdbApiKey;
  } else {
    delete env.TMDB_API_KEY;
  }
  return env;
}

function startServer() {
  const launch = getServerLaunch();

  if (app.isPackaged && !fs.existsSync(launch.command)) {
    console.error('[server] Executável embutido não encontrado:', launch.command);
    return false;
  }

  pyProc = spawn(launch.command, launch.args, {
    env: buildServerEnv(),
    cwd: launch.cwd,
    windowsHide: true,
  });
  pyProc.stdout.on('data', (d) => console.log('[go]', d.toString().trim()));
  pyProc.stderr.on('data', (d) => console.error('[go:err]', d.toString().trim()));
  pyProc.on('exit', (code) => console.log(`[go] exited with code ${code}`));
  return true;
}

function waitForPort(port, cb, attempts = 0) {
  if (attempts > 40) return cb(false);
  const sock = net.connect(port, '127.0.0.1');
  sock.on('connect', () => {
    sock.destroy();
    cb(true);
  });
  sock.on('error', () => setTimeout(() => waitForPort(port, cb, attempts + 1), 300));
}

function getAppIconPath() {
  const candidate = app.isPackaged
    ? path.join(process.resourcesPath, 'public', 'icon-512.png')
    : path.join(__dirname, 'public', 'icon-512.png');
  return fs.existsSync(candidate) ? candidate : undefined;
}

function normalizeBounds(bounds) {
  const b = bounds || {};
  return {
    x: Math.max(0, Math.round(Number(b.x) || 0)),
    y: Math.max(0, Math.round(Number(b.y) || 0)),
    width: Math.max(100, Math.round(Number(b.width) || 800)),
    height: Math.max(100, Math.round(Number(b.height) || 600)),
  };
}

function destroyStreamView() {
  if (!streamView) return;
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeBrowserView(streamView);
    }
  } catch {
    /* ignore */
  }
  try {
    if (streamView.webContents && !streamView.webContents.isDestroyed()) {
      streamView.webContents.destroy();
    }
  } catch {
    /* ignore */
  }
  streamView = null;
}

function ensureStreamView() {
  if (streamView) return streamView;
  streamView = new BrowserView({
    webPreferences: {
      partition: STREAM_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      plugins: true,
    },
  });
  // Match desktop Chrome UA (helps streaming sites)
  try {
    const ua = streamView.webContents.getUserAgent().replace(/Electron\/[\d.]+/, '').trim();
    streamView.webContents.setUserAgent(
      ua ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    );
  } catch {
    /* ignore */
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBrowserView(streamView);
  }
  return streamView;
}

function registerStreamIpc() {
  ipcMain.handle('stream:open', async (_event, payload = {}) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
    const url = String(payload.url || '').trim();
    if (!url) return { ok: false, error: 'url required' };
    const view = ensureStreamView();
    const bounds = normalizeBounds(payload.bounds);
    // Manual bounds only — hub chrome height is not a fixed window inset
    view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false });
    view.setBounds(bounds);
    try {
      await view.webContents.loadURL(url);
    } catch (err) {
      console.error('[stream:open]', err);
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
    return { ok: true };
  });

  ipcMain.handle('stream:resize', async (_event, payload = {}) => {
    if (!streamView) return { ok: false };
    streamView.setBounds(normalizeBounds(payload.bounds));
    return { ok: true };
  });

  ipcMain.handle('stream:close', async () => {
    destroyStreamView();
    return { ok: true };
  });

  ipcMain.handle('stream:navigate', async (_event, payload = {}) => {
    if (!streamView) return { ok: false };
    const url = String(payload.url || '').trim();
    if (!url) return { ok: false };
    await streamView.webContents.loadURL(url);
    return { ok: true };
  });

  ipcMain.handle('stream:go-back', async () => {
    if (!streamView) return { ok: false };
    if (streamView.webContents.canGoBack()) streamView.webContents.goBack();
    return { ok: true };
  });

  ipcMain.handle('stream:go-forward', async () => {
    if (!streamView) return { ok: false };
    if (streamView.webContents.canGoForward()) streamView.webContents.goForward();
    return { ok: true };
  });

  ipcMain.handle('stream:reload', async () => {
    if (!streamView) return { ok: false };
    streamView.webContents.reload();
    return { ok: true };
  });

  ipcMain.handle('stream:get-url', async () => {
    if (!streamView) return { ok: false, url: '' };
    return { ok: true, url: streamView.webContents.getURL() };
  });
}

function createWindow() {
  const iconPath = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0b12',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${PORT}/`);

  // Leave Super Player → tear down BrowserView so it doesn't cover other pages
  const maybeCloseStream = (_event, url) => {
    try {
      const u = new URL(url);
      if (u.pathname !== '/player' && !u.pathname.startsWith('/player/')) {
        destroyStreamView();
      }
    } catch {
      destroyStreamView();
    }
  };
  mainWindow.webContents.on('did-navigate', maybeCloseStream);
  mainWindow.webContents.on('did-navigate-in-page', maybeCloseStream);

  mainWindow.on('resize', () => {
    // Renderer also sends bounds; keep last bounds if view exists
  });

  // Injeta informações de ambiente para o frontend detectar Electron vs browser.
  // Usado principalmente nas páginas de Live (canais / rede-buzz) para fallbacks e avisos.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents
      .executeJavaScript(`
      window.__MEUPLAYER_ENV = {
        isElectron: true,
        platform: ${JSON.stringify(process.platform)},
        version: ${JSON.stringify(app.getVersion ? app.getVersion() : '1.2.0')},
        hasDesktopBridge: !!(window.meuplayerDesktop && window.meuplayerDesktop.isDesktop)
      };

      if (!window.__meuPlayerAutoPlayBridge) {
        window.__meuPlayerAutoPlayBridge = true;
        window.addEventListener('meuplayer:channel-selected', () => {
          window.__meuPlayerChannelSelectedAt = Date.now();
        });
      }
    `)
      .catch(() => {});
  });
  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    const currentUrl = mainWindow.webContents.getURL();
    let pathname = '';
    try {
      pathname = new URL(currentUrl).pathname;
    } catch {
      return;
    }
    const isCanaisPage = pathname === '/canais' || pathname === '/canais/';
    if (!isCanaisPage) return;

    if (message === 'MEUPLAYER_CHANNEL_SELECTED') {
      scheduleChannelPlayerClicks();
      return;
    }
    if (message === 'MEUPLAYER_PLAY_REQUESTED') {
      scheduleChannelPlayerClicks(0);
    }
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key !== 'ArrowUp' && input.key !== 'ArrowDown') return;

    const currentUrl = mainWindow.webContents.getURL();
    let pathname = '';
    try {
      pathname = new URL(currentUrl).pathname;
    } catch {
      return;
    }
    const channelRoutes = [
      '/canais',
      '/canais/',
      '/rede-buzz',
      '/rede-buzz/',
      '/rede-buzz-favoritos',
      '/rede-buzz-favoritos/',
    ];
    if (!channelRoutes.includes(pathname)) return;

    event.preventDefault();
    const direction = input.key === 'ArrowUp' ? -1 : 1;
    mainWindow.webContents
      .executeJavaScript(`
      if (typeof window.meuPlayerSelectAdjacentChannel === 'function') {
        window.meuPlayerSelectAdjacentChannel(${direction});
      }
    `)
      .catch(() => {});
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    destroyStreamView();
    mainWindow = null;
  });
}

function clickChannelPlayer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents
    .executeJavaScript(`
    (function () {
      var iframe = document.getElementById('player');
      if (!iframe) return null;
      var rect = iframe.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    })();
  `)
    .then((point) => {
      if (!point) return;
      mainWindow.webContents.sendInputEvent({
        type: 'mouseDown',
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount: 1,
      });
      mainWindow.webContents.sendInputEvent({
        type: 'mouseUp',
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount: 1,
      });
    })
    .catch(() => {});
}

function scheduleChannelPlayerClicks(initialDelay = 1200) {
  if (autoplayTimer) clearTimeout(autoplayTimer);
  autoplayTimer = setTimeout(() => {
    clickChannelPlayer();
    setTimeout(clickChannelPlayer, 900);
    setTimeout(clickChannelPlayer, 1800);
    setTimeout(clickChannelPlayer, 3200);
  }, initialDelay);
}

/**
 * Strip headers that prevent embedding streaming sites inside <webview>/iframe.
 * Applied to default session + persist:meuplayer-streaming (Super Player).
 */
function stripFrameBlockingHeaders(targetSession) {
  if (!targetSession || targetSession.__meuplayerFrameHeadersPatched) return;
  targetSession.__meuplayerFrameHeadersPatched = true;

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (lower === 'x-frame-options') {
        delete headers[key];
        continue;
      }
      if (
        lower === 'content-security-policy' ||
        lower === 'content-security-policy-report-only'
      ) {
        const values = Array.isArray(headers[key]) ? headers[key] : [headers[key]];
        headers[key] = values.map((value) =>
          String(value)
            // Allow embedding in our shell (sites often set frame-ancestors 'self')
            .replace(/frame-ancestors[^;]*(;|$)/gi, '')
            .replace(/;;+/g, ';')
            .trim()
        );
      }
    }
    callback({ responseHeaders: headers });
  });
}

/**
 * Streaming platforms need real popups (login OAuth, cookie managers).
 * TV/live pages still block ad popups.
 */
function configureWebContentsPolicy() {
  app.on('web-contents-created', (_event, contents) => {
    // Ensure streaming partition also gets header stripping (created lazily)
    try {
      if (typeof contents.session !== 'undefined') {
        stripFrameBlockingHeaders(contents.session);
      }
    } catch {
      /* ignore */
    }

    contents.setWindowOpenHandler((details) => {
      const type = contents.getType();
      // Super Player (webview tag OR BrowserView): allow auth / cookie / payment windows
      const isStreamingGuest =
        type === 'webview' ||
        type === 'browserView' ||
        (contents.session &&
          typeof contents.session.getStoragePath === 'function' &&
          String(contents.session.getStoragePath() || '').includes('meuplayer-streaming'));

      // Also allow when partition name is known via user agent / URL
      let isStreamPartition = false;
      try {
        // Electron sets partition on session
        isStreamPartition =
          contents.session === session.fromPartition(STREAM_PARTITION);
      } catch {
        isStreamPartition = false;
      }

      if (isStreamingGuest || isStreamPartition) {
        console.log(`[popup:allow-stream] ${details.url}`);
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 560,
            height: 780,
            minWidth: 400,
            minHeight: 500,
            autoHideMenuBar: true,
            backgroundColor: '#0b0b12',
            webPreferences: {
              partition: STREAM_PARTITION,
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
            },
          },
        };
      }

      // Main shell (TV channels etc.): block popup spam/ads — open external instead if http(s)
      const url = String(details.url || '');
      if (/^https?:\/\//i.test(url) && mainWindow) {
        const mainUrl = mainWindow.webContents.getURL();
        if (mainUrl.includes('/player')) {
          shell.openExternal(url).catch(() => {});
        }
      }
      console.log(`[popup:block] ${details.url}`);
      return { action: 'deny' };
    });
  });
}

function migrateDotEnvToSettings() {
  const settings = loadSettings();
  if (settings.tmdbApiKey && String(settings.tmdbApiKey).trim()) return;
  loadProjectDotEnv();
  const key = process.env.TMDB_API_KEY && String(process.env.TMDB_API_KEY).trim();
  if (!key) return;
  try {
    fs.mkdirSync(getUserDataPath(), { recursive: true });
    fs.writeFileSync(
      getSettingsPath(),
      `${JSON.stringify({ tmdbApiKey: key }, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    console.error('[settings] Falha ao migrar .env:', error);
  }
}

app.whenReady().then(() => {
  migrateDotEnvToSettings();

  // Default session (main app + temporary guests)
  stripFrameBlockingHeaders(session.defaultSession);
  // Super Player persistent session (cookies/login survive restarts)
  stripFrameBlockingHeaders(session.fromPartition(STREAM_PARTITION));
  configureWebContentsPolicy();
  registerStreamIpc();

  if (!startServer()) {
    console.error('Servidor local não pôde ser iniciado');
    app.quit();
    return;
  }

  waitForPort(PORT, (ok) => {
    if (ok) {
      createWindow();
    } else {
      console.error('Servidor local não respondeu na porta', PORT);
      app.quit();
    }
  });
});

app.on('window-all-closed', () => {
  if (pyProc) pyProc.kill();
  app.quit();
});

app.on('will-quit', () => {
  if (pyProc) {
    pyProc.kill();
    pyProc = null;
  }
});
