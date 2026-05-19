const { app, BrowserWindow, session } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const PORT = 8765;
let pyProc = null;
let mainWindow = null;

function startServer() {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const script = path.join(__dirname, 'server.py');
  pyProc = spawn(py, [script], {
    env: { ...process.env, PORT: String(PORT) },
    cwd: __dirname,
  });
  pyProc.stdout.on('data', (d) => console.log('[py]', d.toString().trim()));
  pyProc.stderr.on('data', (d) => console.error('[py:err]', d.toString().trim()));
  pyProc.on('exit', (code) => console.log(`[py] exited with code ${code}`));
}

function waitForPort(port, cb, attempts = 0) {
  if (attempts > 40) return cb(false);
  const sock = net.connect(port, '127.0.0.1');
  sock.on('connect', () => { sock.destroy(); cb(true); });
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
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  // Remove X-Frame-Options so external players and webviews load correctly
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['x-frame-options'];
    delete headers['X-Frame-Options'];
    callback({ responseHeaders: headers });
  });

  startServer();
  waitForPort(PORT, (ok) => {
    if (ok) {
      createWindow();
    } else {
      console.error('Python server failed to start');
      app.quit();
    }
  });
});

app.on('window-all-closed', () => {
  if (pyProc) pyProc.kill();
  app.quit();
});

app.on('will-quit', () => {
  if (pyProc) { pyProc.kill(); pyProc = null; }
});
