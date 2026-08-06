type Child = Node | string | null | false | undefined;

type ElProps = {
  className?: string;
  html?: string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string>;
  [key: string]: unknown;
};

/** Lightweight DOM factory for the platform hub chrome. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElProps | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach((key) => {
      const val = props[key];
      if (val == null || val === false) return;
      if (key === "className") {
        node.className = String(val);
      } else if (key === "dataset" && typeof val === "object") {
        Object.assign(node.dataset, val as Record<string, string>);
      } else if (key === "html") {
        node.innerHTML = String(val);
      } else if (key.startsWith("on") && typeof val === "function") {
        const eventName = key.slice(2).toLowerCase();
        node.addEventListener(eventName, val as EventListener);
      } else if (key === "attrs" && typeof val === "object") {
        Object.entries(val as Record<string, string>).forEach(([a, v]) => {
          node.setAttribute(a, v);
        });
      } else {
        node.setAttribute(key, val === true ? "" : String(val));
      }
    });
  }
  children.flat().forEach((child) => {
    if (child == null || child === false) return;
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  });
  return node;
}

export function injectIcons(): void {
  if (document.querySelector('link[rel="icon"][href="/favicon.ico"]')) return;
  const specs: Array<{
    rel: string;
    href: string;
    type?: string;
    sizes?: string;
  }> = [
    { rel: "icon", href: "/favicon.ico", sizes: "any" },
    { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    { rel: "manifest", href: "/site.webmanifest" },
  ];
  specs.forEach(({ rel, href, type, sizes }) => {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    if (type) link.type = type;
    if (sizes) link.sizes = sizes;
    document.head.appendChild(link);
  });
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#0d0d1a";
    document.head.appendChild(meta);
  }
}

export function ensureHubStylesheet(): void {
  if (document.querySelector('link[href="/css/hub.css"]')) return;
  if (document.querySelector('link[href="/styles.css"], link[href*="styles.css"]')) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/hub.css";
  document.head.appendChild(link);
}

export function purgeLegacyShellCaches(current: string): void {
  if (typeof caches === "undefined") return;
  caches.keys().then((keys) => {
    keys
      .filter((k) => k.startsWith("meuplayer-shell-") && k !== current)
      .forEach((k) => caches.delete(k));
  });
}
