/** Shared media/catalog domain types for MeuPlayer */

export type MediaType = "movie" | "serie" | "anime" | "dorama";
export type CatalogTypeFilter = MediaType | "all";
export type PlayerProvider = "superflix" | "vidsrc" | string;

export interface MediaItem {
  id: string;
  type: MediaType;
  meta?: MediaMeta;
}

export interface MediaMeta {
  id?: number | string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  tagline?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
  status?: string;
  media_type?: string;
  genre_ids?: number[];
  genres?: Array<{ id?: number; name?: string } | number>;
  seasons?: SeasonMeta[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  runtime?: number;
  episode_run_time?: number[];
  vote_average?: number;
  networks?: Array<{ name?: string }>;
  production_companies?: Array<{ name?: string }>;
  watch_providers?: Array<{ name?: string }>;
  character?: string;
  job?: string;
  [key: string]: unknown;
}

export interface SeasonMeta {
  season_number: number;
  name?: string;
  episode_count?: number;
  overview?: string;
  poster_path?: string | null;
}

export interface EpisodeMeta {
  id?: number | string;
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number;
}

export interface CastMember {
  id: number | string;
  name: string;
  character?: string;
  profile_path?: string | null;
}

export interface PersonRef {
  id: number | string;
  name: string;
  character?: string;
  profile_path?: string | null;
}

export interface PersonDetails {
  birthday?: string;
  deathday?: string;
  place_of_birth?: string;
  known_for_department?: string;
  biography?: string;
}

export interface PersonData {
  details: PersonDetails | null;
  works: MediaItem[];
}

export interface GenreOption {
  value: string;
  label: string;
}

export interface CategoryDef {
  key: MediaType;
  label: string;
  eyebrow: string;
  dedicated?: boolean;
}

export interface CatalogMap {
  movie: MediaItem[];
  serie: MediaItem[];
  anime: MediaItem[];
  dorama: MediaItem[];
}

export interface NetworkOption {
  value: string;
  label: string;
  match: string[];
}

export interface BuildPlayerUrlArgs {
  id: string | number;
  type: MediaType;
  season?: string | number;
  episode?: string | number;
  provider?: PlayerProvider;
}
