import { matchesSearch } from '../../shared/lib/search';

export interface Channel { id: string; nome: string; src: string; category: string }

export function normalizeChannel(item: Record<string, unknown>): Channel | null {
  if (item.is_active === false || [item.category, item.category_id, item.categoryId].some(v => String(v || '').toLowerCase() === 'adulto')) return null;
  const id = String(item.id || '').trim();
  if (!id) return null;
  const src = String(item.embed_url || item.src || `https://rde.buzz/${encodeURIComponent(id)}`);
  try { if (!['https:', 'http:'].includes(new URL(src).protocol)) return null; } catch { return null; }
  return { id, nome: String(item.name || item.nome || id), src, category: String(item.category || '') };
}

export function extractChannels(payload: { success?: boolean; data?: unknown }): Channel[] {
  if (payload.success === false) throw new Error('A origem dos canais está indisponível.');
  const data = payload.data as { channels?: unknown[] } | unknown[];
  const items = Array.isArray(data) ? data : data?.channels || [];
  return items.map(item => normalizeChannel(item as Record<string, unknown>)).filter((item): item is Channel => item !== null);
}

export function filterChannels(channels: Channel[], query: string, category: string, favoritesOnly: boolean, favorites: Set<string>, order: string): Channel[] {
  return channels.filter(channel => (!category || channel.category === category)
    && (!favoritesOnly || favorites.has(channel.id))
    && matchesSearch(`${channel.nome} ${channel.id} ${channel.category}`, query))
    .sort((a, b) => (order === 'desc' ? -1 : 1) * a.nome.localeCompare(b.nome, 'pt-BR'));
}
