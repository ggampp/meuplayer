import { ANIMATION_GENRE_ID, NETWORK_OPTIONS, categories } from "./constants";
import type {
  BuildPlayerUrlArgs,
  CatalogMap,
  CatalogTypeFilter,
  EpisodeMeta,
  MediaItem,
  MediaMeta,
  MediaType,
  SeasonMeta,
} from "../types/media";

export function mediaTypeToRoute(type: MediaType | string): string {
  if (type === "movie") return "filme";
  if (type === "anime") return "anime";
  if (type === "dorama") return "dorama";
  return "serie";
}

export function tmdbAppType(type: MediaType | string): "movie" | "serie" {
  if (type === "movie") return "movie";
  return "serie";
}

export function normalizeList(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(String);
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results.map(String);
    if (Array.isArray(obj.items)) return obj.items.map(String);
    if (Array.isArray(obj.ids)) return obj.ids.map(String);
    return Object.values(obj)
      .flat()
      .filter((value) => typeof value === "string" || typeof value === "number")
      .map(String);
  }
  return [];
}

export function buildPlayerUrl({
  id,
  type,
  season,
  episode,
  provider,
}: BuildPlayerUrlArgs): string {
  if (!id || !type) return "";
  const seasonValue = season || "1";
  const episodeValue = episode || "1";
  if (provider === "vidsrc") {
    if (type === "movie") {
      return `https://vidsrc-embed.ru/embed/movie?tmdb=${id}`;
    }
    return `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${seasonValue}&episode=${episodeValue}`;
  }
  if (type === "movie") {
    return `https://superflixapi.one/filme/${id}`;
  }
  if (type === "anime") {
    return `https://superflixapi.one/anime/${id}/${seasonValue}/${episodeValue}`;
  }
  return `https://superflixapi.one/serie/${id}/${seasonValue}/${episodeValue}`;
}

export function isAnimationTv(meta: MediaMeta | null | undefined): boolean {
  if (!meta) return false;
  const genreIds: number[] = [...(meta.genre_ids || [])];
  (meta.genres || []).forEach((genre) => {
    if (typeof genre === "number") genreIds.push(genre);
    else if (genre?.id != null) genreIds.push(Number(genre.id));
  });
  return genreIds.includes(ANIMATION_GENRE_ID);
}

export function emptyCatalog(): CatalogMap {
  return { movie: [], serie: [], anime: [], dorama: [] };
}

export function categoriesForTypeFilter(typeFilter: CatalogTypeFilter | string) {
  if (typeFilter === "all") return categories.filter((c) => !c.dedicated);
  return categories.filter((category) => category.key === typeFilter);
}

export function buildDiscoverParams(
  apiType: string,
  { genreId, page = "1" }: { genreId?: string; page?: string } = {}
): URLSearchParams {
  const params = new URLSearchParams({ type: apiType, page });
  if (genreId) params.set("genre", genreId);
  return params;
}

export function isReleased(meta: MediaMeta | null | undefined): boolean {
  if (!meta) return true;
  const dateText = meta.release_date || meta.first_air_date;
  if (!dateText) return true;
  const parsed = Date.parse(dateText);
  if (!parsed) return true;
  return parsed <= Date.now();
}

export function isAdultMedia(meta: MediaMeta | null | undefined): boolean {
  if (!meta) return false;
  if (meta.adult === true) return true;
  const text = [
    meta.title,
    meta.name,
    meta.original_title,
    meta.original_name,
    meta.overview,
    meta.tagline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\b(porn|porno|xxx|erotic|erotico|softcore|hardcore)\b/.test(text);
}

export function isVisibleMedia(meta: MediaMeta | null | undefined): boolean {
  return isReleased(meta) && !isAdultMedia(meta);
}

export function pickYear(meta: MediaMeta | null | undefined): string {
  return (meta?.release_date || meta?.first_air_date || "").slice(0, 4);
}

export function typeLabel(type: MediaType | string): string {
  if (type === "movie") return "Filme";
  if (type === "anime") return "Anime";
  if (type === "dorama") return "Dorama";
  return "Série";
}

export function seasonListFromMeta(meta: MediaMeta | null | undefined): SeasonMeta[] {
  if (!meta?.seasons) return [];
  return meta.seasons
    .filter((season) => season.season_number !== 0)
    .sort((a, b) => a.season_number - b.season_number);
}

export function hasMultipleSeasons(meta: MediaMeta | null | undefined): boolean {
  const list = seasonListFromMeta(meta);
  if (list.length > 1) return true;
  const count = Number(meta?.number_of_seasons);
  return Number.isFinite(count) && count > 1;
}

export function needsFullSeriesMeta(
  meta: MediaMeta | null | undefined,
  type: MediaType | string
): boolean {
  if (type === "movie") return false;
  if (!meta) return true;
  if (!Array.isArray(meta.seasons)) return true;
  const regular = seasonListFromMeta(meta);
  const count = Number(meta.number_of_seasons);
  if (regular.length > 1) return false;
  if (Number.isFinite(count) && count > 1 && regular.length < count) {
    return true;
  }
  return regular.length === 0;
}

export function episodesFromSeasonData(
  seasonData: { episodes?: EpisodeMeta[] } | null | undefined
): EpisodeMeta[] {
  return (seasonData?.episodes || [])
    .filter((episode) => episode.episode_number != null)
    .sort((a, b) => a.episode_number - b.episode_number);
}

export function applyDiscoverItems(
  nextResults: CatalogMap,
  nextMeta: Record<string, MediaMeta>,
  items: MediaMeta[],
  options: { onlyType?: string; tvAs?: boolean } = {}
): void {
  const { onlyType, tvAs } = options;
  items.filter(isVisibleMedia).forEach((item) => {
    const id = String(item.id);
    let type: MediaType = "movie";
    if (item.media_type === "tv" || tvAs) {
      const animated = isAnimationTv(item);
      if (onlyType === "anime") {
        if (!animated) return;
        type = "anime";
      } else if (onlyType === "serie") {
        if (animated) return;
        type = "serie";
      } else {
        type = animated ? "anime" : "serie";
      }
    } else if (onlyType && onlyType !== "movie") {
      return;
    }
    nextResults[type].push({ id, type, meta: item });
    nextMeta[`${type}-${id}`] = item;
  });
}

export function itemMatchesNetwork(
  meta: MediaMeta | null | undefined,
  networkValue: string
): boolean {
  if (!networkValue || networkValue === "all") return true;
  const option = NETWORK_OPTIONS.find((opt) => opt.value === networkValue);
  if (!option) return true;
  const sources = [
    ...(meta?.networks || []),
    ...(meta?.production_companies || []),
    ...(meta?.watch_providers || []),
  ];
  if (!sources.length) return false;
  const names = sources
    .map((src) => String(src?.name || "").toLowerCase())
    .filter(Boolean);
  return names.some((name) => option.match.some((needle) => name.includes(needle)));
}

export function itemMatchesStatus(
  meta: MediaMeta | null | undefined,
  type: MediaType | string,
  statusValue: string
): boolean {
  if (!statusValue || statusValue === "all") return true;
  const status = String(meta?.status || "").toLowerCase();
  const isMovie = type === "movie";
  const finished = isMovie
    ? status === "released" || (!status && !!meta?.release_date)
    : ["ended", "canceled", "cancelled"].includes(status);
  if (statusValue === "finished") return finished;
  if (statusValue === "ongoing") return !finished;
  return true;
}

export function itemMatchesYear(
  meta: MediaMeta | null | undefined,
  yearValue: string
): boolean {
  if (!yearValue) return true;
  const year = String(yearValue).trim();
  if (!year) return true;
  const date = meta?.release_date || meta?.first_air_date || "";
  return date.startsWith(year);
}

export function displayTitle(meta: MediaMeta | null | undefined, fallback: string): string {
  return (
    meta?.title ||
    meta?.name ||
    meta?.original_title ||
    meta?.original_name ||
    fallback
  );
}

export type { MediaItem, MediaMeta, MediaType, CatalogMap };
