import type { MediaItem } from '../types/media';

export function sortVodItems(items: MediaItem[], order: string): MediaItem[] {
  if (order === 'relevance') return items;
  return [...items].sort((a, b) => {
    const am = a.meta || {}, bm = b.meta || {};
    if (order === 'title') return String(am.title || am.name || '').localeCompare(String(bm.title || bm.name || ''), 'pt-BR');
    if (order === 'rating') return Number(bm.vote_average || 0) - Number(am.vote_average || 0);
    if (order === 'popularity') return Number(bm.popularity || 0) - Number(am.popularity || 0);
    return (Date.parse(bm.release_date || bm.first_air_date || '') || 0) - (Date.parse(am.release_date || am.first_air_date || '') || 0);
  });
}
