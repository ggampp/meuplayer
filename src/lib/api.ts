import { API_BASE, META_BATCH_CHUNK } from "./constants";
import { tmdbAppType } from "./media";
import type { MediaMeta, MediaType } from "../types/media";

export async function fetchJson<T = Record<string, unknown>>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const data = (await res.json().catch(() => ({}))) as T & {
    detail?: string;
    error?: string;
  };
  if (!res.ok) {
    const detail = data.detail || data.error || "Falha na API";
    throw new Error(detail);
  }
  return data;
}

export async function fetchMetaBatch(
  type: MediaType | string,
  ids: Array<string | number>
): Promise<Record<string, MediaMeta>> {
  if (!ids.length) return {};
  const unique = [...new Set(ids.map(String))];
  const merged: Record<string, MediaMeta> = {};
  for (let offset = 0; offset < unique.length; offset += META_BATCH_CHUNK) {
    const chunk = unique.slice(offset, offset + META_BATCH_CHUNK);
    const query = new URLSearchParams({
      type: tmdbAppType(type),
      ids: chunk.join(","),
    });
    const data = await fetchJson<{ items?: Record<string, MediaMeta> }>(
      `/api/media/meta/batch?${query.toString()}`
    );
    Object.assign(merged, data.items || {});
  }
  return merged;
}
