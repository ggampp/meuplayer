export interface StreamingProvider {
  id?: string;
  name: string;
  url: string;
  icon?: string;
  isDefault?: boolean;
  category?: string;
}

export interface NavLink {
  label: string;
  path: string;
  icon?: "download" | "settings" | "film" | "tv";
}

export interface NativePlatform {
  id: "meuplayer" | "tv";
  name: string;
  path: string;
  title: string;
  icon: "film" | "tv";
  live?: boolean;
}

export const NATIVE_PLATFORMS: NativePlatform[] = [
  {
    id: "meuplayer",
    name: "MeuPlayer",
    path: "/",
    title: "Catálogo MeuPlayer — filmes, séries, animes e doramas",
    icon: "film",
  },
  {
    id: "tv",
    name: "TV",
    path: "/rede-buzz",
    title: "TV ao vivo",
    icon: "tv",
    live: true,
  },
];

export const CATALOG_LINKS: NavLink[] = [
  { label: "Início", path: "/" },
  { label: "Filmes", path: "/filme" },
  { label: "Séries", path: "/serie" },
  { label: "Animes", path: "/anime" },
  { label: "Doramas", path: "/dorama" },
  { label: "Fileiras", path: "/netflix" },
];

export const TV_LINKS: NavLink[] = [
  { label: "Canais", path: "/rede-buzz" },
  { label: "Favoritos", path: "/rede-buzz-favoritos" },
];

export const UTILITY_LINKS: NavLink[] = [
  { label: "Downloads", path: "/downloads", icon: "download" },
  { label: "Config", path: "/configuracoes", icon: "settings" },
];

export const CATALOG_LIST_PATHS = new Set([
  "/",
  "/filme",
  "/serie",
  "/anime",
  "/dorama",
  "/netflix",
]);

export const CATALOG_PREFIXES = [
  "/filme",
  "/serie",
  "/anime",
  "/dorama",
  "/netflix",
];
export const TV_PREFIXES = ["/rede-buzz", "/canais"];

export const DEFAULT_PROVIDERS: StreamingProvider[] = [
  {
    id: "max",
    name: "Max",
    url: "https://www.hbomax.com/br/pt",
    icon: "/img/providers/max.svg",
  },
  {
    id: "netflix",
    name: "Netflix",
    url: "https://www.netflix.com/browse",
    icon: "/img/providers/netflix.svg",
  },
  {
    id: "recordplus",
    name: "Record Plus",
    url: "https://www.recordplus.com/Live/LiveEvent/180?groupId=7",
    icon: "/img/providers/recordplus.svg",
  },
  {
    id: "primevideo",
    name: "Prime Video",
    url: "https://www.primevideo.com/region/na/storefront",
    icon: "/img/providers/primevideo.svg",
  },
];

export const HUB_CACHE_NAME = "meuplayer-shell-v3-hub";

export const ICONS: Record<string, string> = {
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};
