export {};

declare global {
  interface MeuPlayerEnv {
    isElectron: boolean;
    platform?: string;
    version?: string;
  }

  interface MeuPlayerProvider {
    id?: string;
    name: string;
    url: string;
    icon?: string;
    isDefault?: boolean;
    category?: string;
  }

  interface MeuPlayerProviderModalApi {
    open: () => void;
    close: () => void;
  }

  interface MeuPlayerRedeBuzzUIApi {
    init: (options: { mode?: 'all' | 'favorites' }) => void;
    buildEmbedUrl?: (channel: unknown) => string;
    normalizeChannel?: (item: unknown) => unknown;
    extractChannels?: (payload: unknown) => unknown[];
  }

  interface MeuPlayerRedeBuzzStoreApi {
    list: () => unknown[];
    has: (id: string | number | null | undefined) => boolean;
    toggle: (channel: unknown) => boolean;
    remove: (id: string | number | null | undefined) => void;
    count: () => number;
  }

  interface Window {
    __MEUPLAYER_ENV?: MeuPlayerEnv;
    MEUPLAYER_ROUTE?: string;
    MEUPLAYER_LAYOUT?: string;
    MeuPlayerProviderModal?: MeuPlayerProviderModalApi;
    MeuPlayerRedeBuzzStore?: MeuPlayerRedeBuzzStoreApi;
    MeuPlayerRedeBuzzUI?: MeuPlayerRedeBuzzUIApi;
    meuPlayerSelectAdjacentChannel?: (delta: number) => void;
  }

  // Electron <webview> element (Chromium guest)
  interface WebViewElement extends HTMLElement {
    src: string;
    partition?: string;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    reload(): void;
    getURL(): string;
    loadURL?(url: string): void;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: string;
        useragent?: string;
        webpreferences?: string;
      };
    }
  }
}
