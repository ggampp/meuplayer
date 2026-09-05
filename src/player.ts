export {};
/**
 * Super Player host
 * - Electron + preload bridge → BrowserView (correct full-area streaming)
 * - Electron without bridge → <webview> with forced pixel size
 * - Browser → iframe + external fallback
 */
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const DEFAULT_URL = "https://www.hbomax.com/br/pt";
const STREAMING_PARTITION = "persist:meuplayer-streaming";

declare global {
  interface MeuPlayerDesktopBridge {
    isDesktop: boolean;
    openStream: (
      url: string,
      bounds: { x: number; y: number; width: number; height: number }
    ) => Promise<{ ok: boolean; error?: string }>;
    resizeStream: (bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => Promise<{ ok: boolean }>;
    closeStream: () => Promise<{ ok: boolean }>;
    navigateStream: (url: string) => Promise<{ ok: boolean }>;
    streamGoBack: () => Promise<{ ok: boolean }>;
    streamGoForward: () => Promise<{ ok: boolean }>;
    streamReload: () => Promise<{ ok: boolean }>;
    streamGetUrl: () => Promise<{ ok: boolean; url?: string }>;
  }

  interface Window {
    meuplayerDesktop?: MeuPlayerDesktopBridge;
  }
}

const params = new URLSearchParams(window.location.search);
let targetUrl = params.get("url") || DEFAULT_URL;
let targetName = params.get("name") || "";
const providerId = params.get("providerId") || "";

const ui = {
  back: document.getElementById("btnBack") as HTMLButtonElement | null,
  forward: document.getElementById("btnForward") as HTMLButtonElement | null,
  reload: document.getElementById("btnReload") as HTMLButtonElement | null,
  home: document.getElementById("btnHome") as HTMLButtonElement | null,
  openExternal: document.getElementById("btnOpenExternal") as HTMLButtonElement | null,
  fullscreen: document.getElementById("btnFullscreen") as HTMLButtonElement | null,
  viewport: document.getElementById("playerViewport") as HTMLElement | null,
  loading: document.getElementById("playerLoading") as HTMLElement | null,
  loadingText: document.getElementById("playerLoadingText") as HTMLElement | null,
  title: document.getElementById("playerTitle") as HTMLElement | null,
  shell: document.getElementById("superPlayer") as HTMLElement | null,
};

type Embed = HTMLIFrameElement | WebViewElement;
let activeEmbed: Embed | null = null;
let usingBrowserView = false;
let resizeObserver: ResizeObserver | null = null;

function desktop(): MeuPlayerDesktopBridge | null {
  return window.meuplayerDesktop?.isDesktop ? window.meuplayerDesktop : null;
}

function isElectron(): boolean {
  return (
    !!(window.__MEUPLAYER_ENV && window.__MEUPLAYER_ENV.isElectron) ||
    navigator.userAgent.includes("Electron") ||
    !!desktop()
  );
}

function setLoading(visible: boolean, message?: string): void {
  if (!ui.loading) return;
  if (message && ui.loadingText) ui.loadingText.textContent = message;
  ui.loading.classList.toggle("hidden", !visible);
}

function setPlatformTitle(name: string): void {
  document.title = "MeuPlayer · " + name;
  if (ui.title) ui.title.textContent = name;
  if (ui.loadingText) ui.loadingText.textContent = "Carregando " + name + "…";
}

function hostnameFallback(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.charAt(0).toUpperCase() + host.slice(1);
  } catch {
    return "Plataforma";
  }
}

async function loadProviderMetadata(): Promise<void> {
  try {
    const res = await fetch("/api/providers");
    if (res.ok) {
      const providers = (await res.json()) as Array<{
        id?: string;
        name: string;
        url: string;
      }>;
      const match =
        (providerId && providers.find((p) => p.id === providerId)) ||
        providers.find(
          (p) =>
            p.url === targetUrl ||
            targetUrl.includes(p.url) ||
            (p.url && p.url.includes(targetUrl))
        );
      if (match) {
        targetName = match.name;
        targetUrl = match.url;
      }
    }
  } catch (e) {
    console.warn("Could not fetch providers metadata:", e);
  }
  if (!targetName) targetName = hostnameFallback(targetUrl);
  setPlatformTitle(targetName);
}

function getViewportBounds(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const el = ui.viewport;
  if (!el) {
    return {
      x: 0,
      y: 80,
      width: window.innerWidth,
      height: Math.max(200, window.innerHeight - 80),
    };
  }
  const rect = el.getBoundingClientRect();
  // BrowserView bounds are relative to the window content area
  const dpr = window.devicePixelRatio || 1;
  // Electron BrowserView uses DIP (CSS pixels), not device pixels
  void dpr;
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(100, Math.round(rect.width)),
    height: Math.max(100, Math.round(rect.height)),
  };
}

function styleEmbed(node: HTMLElement): void {
  // Electron <webview> requires flex display + explicit pixel size
  node.style.cssText = [
    "position:absolute",
    "top:0",
    "left:0",
    "right:0",
    "bottom:0",
    "width:100%",
    "height:100%",
    "min-width:100%",
    "min-height:100%",
    "border:0",
    "outline:none",
    "display:flex",
    "background:#000",
  ].join(";");
}

function forceEmbedPixelSize(node: HTMLElement): void {
  if (!ui.viewport) return;
  const rect = ui.viewport.getBoundingClientRect();
  const w = Math.max(100, Math.round(rect.width));
  const h = Math.max(100, Math.round(rect.height));
  node.style.width = w + "px";
  node.style.height = h + "px";
  node.style.minWidth = w + "px";
  node.style.minHeight = h + "px";
  node.setAttribute("width", String(w));
  node.setAttribute("height", String(h));
}

function clearViewport(): void {
  if (!ui.viewport) return;
  Array.from(ui.viewport.children).forEach((child) => {
    if (child.id === "playerLoading") return;
    child.remove();
  });
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showEmbedFallback(reason: string): void {
  if (!ui.viewport) return;
  clearViewport();
  setLoading(false);
  const box = document.createElement("div");
  box.className = "player-fallback";
  box.innerHTML =
    '<div class="player-fallback__card">' +
    '<p class="player-fallback__eyebrow">Streaming</p>' +
    '<h2 class="player-fallback__title">' +
    escapeHtml(targetName || "Plataforma") +
    "</h2>" +
    '<p class="player-fallback__text">' +
    escapeHtml(reason) +
    "</p>" +
    '<div class="player-fallback__actions">' +
    '<button type="button" class="player-fallback__btn player-fallback__btn--primary" id="fallbackOpen">Abrir no navegador</button>' +
    '<button type="button" class="player-fallback__btn" id="fallbackRetry">Tentar de novo</button>' +
    "</div></div>";
  ui.viewport.appendChild(box);
  box.querySelector("#fallbackOpen")?.addEventListener("click", () => {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  });
  box.querySelector("#fallbackRetry")?.addEventListener("click", () => {
    box.remove();
    void initPlayer();
  });
}

function watchViewportResize(): void {
  if (!ui.viewport) return;
  if (resizeObserver) resizeObserver.disconnect();

  const onResize = () => {
    if (usingBrowserView && desktop()) {
      void desktop()!.resizeStream(getViewportBounds());
    } else if (activeEmbed) {
      forceEmbedPixelSize(activeEmbed as HTMLElement);
    }
  };

  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(ui.viewport);
  window.addEventListener("resize", onResize);
}

async function createBrowserViewHost(): Promise<boolean> {
  const bridge = desktop();
  if (!bridge || !ui.viewport) return false;

  usingBrowserView = true;
  document.body.classList.add("player-shell--browser-view");
  clearViewport();
  setLoading(true, "Carregando " + targetName + "…");

  // Mark viewport so layout CSS can leave a transparent hole for BrowserView
  ui.viewport.classList.add("player-viewport--native");
  ui.viewport.innerHTML =
    '<div class="player-viewport__native-hint" id="playerNativeHint">' +
    '<div class="player-loading__spinner" aria-hidden="true"></div>' +
    "<span>Carregando " +
    escapeHtml(targetName) +
    "…</span></div>";

  // Wait a frame so hub nav has finished layout (bounds must be accurate)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Extra tick for sticky nav measure
  await new Promise((r) => setTimeout(r, 50));

  const bounds = getViewportBounds();
  console.info("[player] BrowserView bounds", bounds);

  const result = await bridge.openStream(targetUrl, bounds);
  if (!result?.ok) {
    console.error("[player] BrowserView open failed", result);
    usingBrowserView = false;
    document.body.classList.remove("player-shell--browser-view");
    ui.viewport.classList.remove("player-viewport--native");
    return false;
  }

  setLoading(false);
  const hint = document.getElementById("playerNativeHint");
  if (hint) hint.remove();

  watchViewportResize();
  // Periodic re-sync (nav height can change after fonts/providers load)
  setTimeout(() => void bridge.resizeStream(getViewportBounds()), 200);
  setTimeout(() => void bridge.resizeStream(getViewportBounds()), 800);
  return true;
}

function createWebview(): void {
  if (!ui.viewport) return;
  usingBrowserView = false;
  clearViewport();
  setLoading(true, "Carregando " + targetName + "…");

  const webview = document.createElement("webview") as unknown as WebViewElement;
  webview.id = "superWebview";
  webview.setAttribute("partition", STREAMING_PARTITION);
  webview.setAttribute("allowpopups", "true");
  webview.setAttribute("useragent", DEFAULT_USER_AGENT);
  webview.setAttribute(
    "webpreferences",
    "nativeWindowOpen=yes, contextIsolation=yes, javascript=yes, plugins=yes, webSecurity=yes"
  );
  styleEmbed(webview);

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    setLoading(false);
    forceEmbedPixelSize(webview as unknown as HTMLElement);
  };

  webview.addEventListener("did-start-loading", () => {
    settled = false;
    setLoading(true, "Carregando " + targetName + "…");
  });
  webview.addEventListener("did-stop-loading", settle);
  webview.addEventListener("dom-ready", settle);
  webview.addEventListener(
    "did-fail-load",
    ((e: Event & { errorCode?: number; errorDescription?: string; isMainFrame?: boolean }) => {
      if (e && (e.errorCode === -3 || e.isMainFrame === false)) return;
      settle();
      if (e?.isMainFrame) {
        showEmbedFallback(
          "Não foi possível carregar esta plataforma (" +
            (e.errorDescription || "erro de rede") +
            ")."
        );
      }
    }) as EventListener
  );

  ui.viewport.appendChild(webview);
  activeEmbed = webview;
  forceEmbedPixelSize(webview as unknown as HTMLElement);
  webview.setAttribute("src", targetUrl);
  watchViewportResize();
  setTimeout(settle, 12000);
}

function createIframe(): void {
  if (!ui.viewport) return;
  usingBrowserView = false;
  clearViewport();
  setLoading(true, "Carregando " + targetName + "…");

  const iframe = document.createElement("iframe");
  iframe.id = "superIframe";
  iframe.title = targetName || "Plataforma de streaming";
  iframe.allow =
    "autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-read; clipboard-write";
  iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
  styleEmbed(iframe);

  let loaded = false;
  iframe.addEventListener("load", () => {
    loaded = true;
    setLoading(false);
  });

  ui.viewport.appendChild(iframe);
  activeEmbed = iframe;
  forceEmbedPixelSize(iframe);
  iframe.src = targetUrl;
  watchViewportResize();

  setTimeout(() => {
    if (!loaded) {
      setLoading(false);
      showEmbedFallback(
        "O navegador costuma bloquear Netflix, Max, Prime etc. dentro de iframe. Use o app desktop MeuPlayer ou abra no navegador externo."
      );
    }
  }, 5000);
}

async function initPlayer(): Promise<void> {
  activeEmbed = null;

  // Prefer native BrowserView (full chrome area, correct size)
  if (desktop()) {
    const ok = await createBrowserViewHost();
    if (ok) return;
    console.warn("[player] falling back to <webview>");
  }

  if (isElectron()) createWebview();
  else createIframe();
}

async function currentEmbedUrl(): Promise<string> {
  if (usingBrowserView && desktop()) {
    const r = await desktop()!.streamGetUrl();
    return r.url || targetUrl;
  }
  try {
    if (activeEmbed && "getURL" in activeEmbed && typeof activeEmbed.getURL === "function") {
      return activeEmbed.getURL() || targetUrl;
    }
  } catch {
    /* ignore */
  }
  return targetUrl;
}

function bindToolbar(): void {
  ui.back?.addEventListener("click", () => {
    if (usingBrowserView && desktop()) {
      void desktop()!.streamGoBack();
      return;
    }
    try {
      if (
        activeEmbed &&
        "goBack" in activeEmbed &&
        typeof activeEmbed.goBack === "function" &&
        activeEmbed.canGoBack()
      ) {
        activeEmbed.goBack();
        return;
      }
    } catch {
      /* ignore */
    }
    window.history.back();
  });

  ui.forward?.addEventListener("click", () => {
    if (usingBrowserView && desktop()) {
      void desktop()!.streamGoForward();
      return;
    }
    try {
      if (
        activeEmbed &&
        "goForward" in activeEmbed &&
        typeof activeEmbed.goForward === "function" &&
        activeEmbed.canGoForward()
      ) {
        activeEmbed.goForward();
      }
    } catch {
      /* ignore */
    }
  });

  ui.reload?.addEventListener("click", () => {
    if (usingBrowserView && desktop()) {
      void desktop()!.streamReload();
      return;
    }
    try {
      if (activeEmbed && "reload" in activeEmbed && typeof activeEmbed.reload === "function") {
        activeEmbed.reload();
        return;
      }
    } catch {
      /* ignore */
    }
    if (activeEmbed && "src" in activeEmbed) {
      (activeEmbed as HTMLIFrameElement).src = targetUrl;
    }
  });

  ui.home?.addEventListener("click", () => {
    if (desktop()) void desktop()!.closeStream();
    window.location.href = "/";
  });

  ui.openExternal?.addEventListener("click", () => {
    void currentEmbedUrl().then((url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });

  ui.fullscreen?.addEventListener("click", () => {
    const container = ui.shell || document.documentElement;
    const anyContainer = container as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    if (!document.fullscreenElement) {
      if (anyContainer.requestFullscreen) anyContainer.requestFullscreen();
      else if (anyContainer.webkitRequestFullscreen) anyContainer.webkitRequestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    // Resync BrowserView after fullscreen toggle
    setTimeout(() => {
      if (usingBrowserView && desktop()) {
        void desktop()!.resizeStream(getViewportBounds());
      }
    }, 100);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
      e.preventDefault();
      ui.reload?.click();
    } else if (e.key === "F11") {
      e.preventDefault();
      ui.fullscreen?.click();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (desktop()) void desktop()!.closeStream();
  });
}

function boot(): void {
  document.documentElement.classList.add("player-shell");
  document.body.classList.add("player-shell");
  bindToolbar();
  loadProviderMetadata().then(() => {
    if (!window.__MEUPLAYER_ENV && navigator.userAgent.includes("Electron")) {
      window.__MEUPLAYER_ENV = {
        isElectron: true,
        platform: "win32",
        version: "1.2.0",
      };
    }
    void initPlayer();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  setTimeout(boot, 50);
}
