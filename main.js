const { app, BrowserWindow, session } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PORT = 8765;
let pyProc = null;
let mainWindow = null;
let autoplayTimer = null;

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

function getServerLaunch() {
  if (app.isPackaged) {
    const resources = process.resourcesPath;
    return {
      command: path.join(resources, 'meuplayer-server.exe'),
      args: [],
      cwd: resources,
      staticDir: path.join(resources, 'public'),
    };
  }

  return {
    command: process.platform === 'win32' ? 'python' : 'python3',
    args: [path.join(__dirname, 'server.py')],
    cwd: __dirname,
    staticDir: path.join(__dirname, 'public'),
  };
}

function buildServerEnv() {
  const settings = loadSettings();
  const launch = getServerLaunch();
  const tmdbApiKey =
    settings.tmdbApiKey || process.env.TMDB_API_KEY || '';

  return {
    ...process.env,
    PORT: String(PORT),
    MEUPLAYER_USER_DATA: getUserDataPath(),
    MEUPLAYER_STATIC_DIR: launch.staticDir,
    TMDB_API_KEY: tmdbApiKey,
  };
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
  pyProc.stdout.on('data', (d) => console.log('[py]', d.toString().trim()));
  pyProc.stderr.on('data', (d) => console.error('[py:err]', d.toString().trim()));
  pyProc.on('exit', (code) => console.log(`[py] exited with code ${code}`));
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0b12',
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${PORT}/`);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents
      .executeJavaScript(`
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

function blockPopupWindows() {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler((details) => {
      console.log(`[popup:block] ${details.url}`);
      return { action: 'deny' };
    });

    contents.on('did-create-window', (window, details) => {
      console.log(`[popup:close] ${details.url}`);
      window.close();
    });
  });
}

app.whenReady().then(() => {
  blockPopupWindows();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['x-frame-options'];
    delete headers['X-Frame-Options'];
    callback({ responseHeaders: headers });
  });

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
