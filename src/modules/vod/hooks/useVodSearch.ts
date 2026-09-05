import { useEffect, useState } from 'react';
import { fetchJson } from '../../../shared/lib/http';
import { emptyCatalog, isAnimationTv, isVisibleMedia } from '../lib/media';
import type { CatalogMap, MediaMeta, MediaType } from '../types/media';

interface SearchOptions { search: string; type: string; genre: string; year: string; rating: string; sort: string; status: string; network: string }
interface Result { results?: MediaMeta[]; total_pages?: number }

export function useVodSearch(options: SearchOptions) {
  const { search, type, genre, year, rating, sort, status, network } = options;
  const enabled = search.trim().length >= 2 || genre !== 'all' || !!year || !!rating || sort !== 'relevance' || status !== 'all' || network !== 'all';
  const key = JSON.stringify(options);
  const [pagination, setPagination] = useState({ key, page: 1 });
  const page = pagination.key === key ? pagination.page : 1;
  const [state, setState] = useState<{ key: string; page: number; items: CatalogMap | null; busy: boolean; error: string; pages: number }>({ key: '', page: 1, items: null, busy: false, error: '', pages: 1 });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ key, page, items: emptyCatalog(), busy: true, error: '', pages: 1 });
    const timer = setTimeout(async () => {
      try {
        const types = type === 'all' ? ['movie', 'tv'] : [type === 'movie' ? 'movie' : 'tv'];
        const [genreType, genreId] = genre.split(':');
        const responses = await Promise.all(types.filter(t => genre === 'all' || t === genreType).map(async apiType => {
          const query = new URLSearchParams({ type: apiType, page: String(page) });
          const searching = search.trim().length >= 2;
          if (searching) query.set('query', search.trim());
          else {
            query.set('sort', sort === 'relevance' ? 'popularity' : sort);
            if (genreId) query.set('genre', genreId);
            if (type === 'anime' && !genreId) query.set('genre', '16');
            if (type === 'dorama') query.set('original_language', 'ko');
            if (rating) query.set('rating', rating);
          }
          if (year) query.set('year', year);
          const data = await fetchJson<Result>(`/api/tmdb/${searching ? 'search' : 'discover'}?${query}`, controller.signal);
          return { apiType, data };
        }));
        if (controller.signal.aborted) return;
        const items = emptyCatalog();
        responses.forEach(({ apiType, data }) => (data.results || []).filter(isVisibleMedia).forEach(meta => {
          let target: MediaType = apiType === 'movie' ? 'movie' : isAnimationTv(meta) ? 'anime' : 'serie';
          if (type === 'dorama') { if (meta.original_language !== 'ko') return; target = 'dorama'; }
          if (type !== 'all' && type !== target) return;
          items[target].push({ id: String(meta.id), type: target, meta });
        }));
        setState({ key, page, items, busy: false, error: '', pages: Math.min(500, Math.max(1, ...responses.map(r => r.data.total_pages || 1))) });
      } catch (error) {
        if (!controller.signal.aborted) setState({ key, page, items: emptyCatalog(), busy: false, error: error instanceof Error ? error.message : 'Falha na pesquisa.', pages: 1 });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, page, enabled]);

  const current = state.key === key && state.page === page;
  return { results: enabled ? current ? state.items : emptyCatalog() : null,
    busy: enabled && (!current || state.busy), error: enabled && current ? state.error : '',
    page, pages: current ? state.pages : 1,
    setPage: (value: number) => setPagination({ key, page: value }) };
}
