import type { CategoryDef, NetworkOption } from "../types/media";

export const API_BASE = "";

export const categories: CategoryDef[] = [
  { key: "movie", label: "Filmes", eyebrow: "Cinema" },
  { key: "serie", label: "Séries", eyebrow: "Live action" },
  { key: "anime", label: "Animes", eyebrow: "Animação" },
  { key: "dorama", label: "Doramas", eyebrow: "K-Drama", dedicated: true },
];

export const IMAGE_BASE = "/api/image/tmdb/w500";
export const BACKDROP_BASE = "/api/image/tmdb/w1280";
export const STILL_BASE = "/api/image/tmdb/w780";
export const PROFILE_BASE = "/api/image/tmdb/w185";

export const ROUTE_TO_TYPE: Record<string, string> = {
  filme: "movie",
  serie: "serie",
  anime: "anime",
  dorama: "dorama",
};

export const META_BATCH_CHUNK = 25;
export const ANIMATION_GENRE_ID = 16;

export const NETWORK_OPTIONS: NetworkOption[] = [
  { value: "netflix", label: "Netflix", match: ["netflix"] },
  { value: "prime", label: "Prime Video", match: ["amazon", "prime video"] },
  { value: "hbo", label: "HBO / Max", match: ["hbo", "max original", "warner"] },
  { value: "disney", label: "Disney+", match: ["disney", "star+", "hulu"] },
  { value: "apple", label: "Apple TV+", match: ["apple"] },
  { value: "globoplay", label: "Globoplay", match: ["globo"] },
  { value: "paramount", label: "Paramount+", match: ["paramount"] },
];

export function getRouteTypeFromPath(pathname: string): string | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  return ROUTE_TO_TYPE[firstSegment] || null;
}

export const ROUTE_TYPE: string | null =
  (typeof window !== "undefined" && window.MEUPLAYER_ROUTE) ||
  (typeof window !== "undefined"
    ? getRouteTypeFromPath(window.location.pathname)
    : null);

export const NETFLIX_LAYOUT =
  typeof window !== "undefined" && window.MEUPLAYER_LAYOUT === "netflix";
