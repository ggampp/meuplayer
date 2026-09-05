import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../../shared/lib/http';
import { MeuPlayerRedeBuzzStore as store } from './favorites';
import { extractChannels, filterChannels, normalizeChannel, type Channel } from './channels';

export function TvApp() {
  const initial = new URLSearchParams(location.search);
  const [query, setQuery] = useState(initial.get('q') || '');
  const [category, setCategory] = useState(initial.get('category') || '');
  const [order, setOrder] = useState(initial.get('order') === 'desc' ? 'desc' : 'asc');
  const favoritesPage = location.pathname.includes('favoritos');
  const [favoritesOnly, setFavoritesOnly] = useState(favoritesPage || initial.get('favorites') === '1');
  const [favorites, setFavorites] = useState(() => new Set(store.list().map(c => c.id)));
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const update = () => setFavorites(new Set(store.list().map(c => c.id)));
    window.addEventListener('meuplayer:rede-buzz-favorites-changed', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('meuplayer:rede-buzz-favorites-changed', update); window.removeEventListener('storage', update); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchJson<{ data?: unknown }>('/api/rede-buzz/channels', controller.signal).then(payload => {
      const items = extractChannels(payload);
      setChannels(items);
      const requested = new URLSearchParams(location.search).get('canal');
      if (requested) setActive(previous => previous || items.find(c => c.id === requested) || null);
    }).catch(err => {
      if (controller.signal.aborted) return;
      setError(err.message);
      setChannels(store.list().map(c => normalizeChannel(c as unknown as Record<string, unknown>)).filter((c): c is Channel => c !== null));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ q: query, category, order: order === 'desc' ? order : '', favorites: favoritesOnly ? '1' : '' })) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }, [query, category, order, favoritesOnly]);

  const categories = useMemo(() => [...new Set(channels.map(c => c.category).filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR')), [channels]);
  const visible = useMemo(() => filterChannels(channels, query, category, favoritesOnly, favorites, order), [channels, query, category, favoritesOnly, favorites, order]);
  function select(channel: Channel) {
    setActive(channel);
    const url = new URL(location.href); url.searchParams.set('canal', channel.id); history.replaceState(null, '', url);
  }
  const clear = () => { setQuery(''); setCategory(''); setOrder('asc'); setFavoritesOnly(favoritesPage); };

  return <main className="tv-module">
    <header className="module-heading"><div><p className="module-kicker">SINTONIZE SEU MOMENTO</p><h1>TV ao vivo<span className="live-dot" aria-hidden="true" /></h1></div><span>Seus canais. No seu ritmo.</span></header>
    <div className="tv-layout">
      <aside className="tv-browser" aria-label="Pesquisar canais">
        <label className="module-field"><span>Encontre um canal</span><input type="search" placeholder="Nome, categoria ou identificador" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="tv-filter-row"><label className="module-field"><span>Categoria</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="module-field"><span>Ordem</span><select value={order} onChange={e => setOrder(e.target.value)}><option value="asc">A → Z</option><option value="desc">Z → A</option></select></label></div>
        <div className="tv-filter-row"><button className={'module-button' + (favoritesOnly ? ' is-selected' : '')} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(v => !v)}>★ Favoritos</button><button className="module-text-button" onClick={clear}>Limpar filtros</button></div>
        <p className="module-status" aria-live="polite">{loading ? 'Carregando canais…' : `${visible.length} de ${channels.length} canais carregados`}</p>
        {error && <div className="module-error" role="alert"><p>{error} Os favoritos salvos continuam acessíveis.</p><button className="module-button" onClick={() => setAttempt(v => v + 1)}>Tentar novamente</button></div>}
        <div className="tv-channel-list" aria-label="Canais">
          {!loading && !visible.length && <div className="module-empty"><h2>Nenhum canal encontrado</h2><p>Experimente outro nome ou ajuste os filtros.</p></div>}
          {visible.map(channel => <div key={channel.id} className={'tv-channel' + (active?.id === channel.id ? ' is-active' : '')}><button className="tv-channel__select" onClick={() => select(channel)} aria-pressed={active?.id === channel.id}><span className="tv-channel__symbol" aria-hidden="true">{channel.nome.slice(0,2).toUpperCase()}</span><span><strong>{channel.nome}</strong><small>{channel.category || 'TV ao vivo'}</small></span><span aria-hidden="true">▷</span></button><button className="tv-channel__favorite" aria-label={`${favorites.has(channel.id) ? 'Remover' : 'Adicionar'} ${channel.nome} ${favorites.has(channel.id) ? 'dos' : 'aos'} favoritos`} aria-pressed={favorites.has(channel.id)} onClick={() => store.toggle(channel)}>{favorites.has(channel.id) ? '★' : '☆'}</button></div>)}
        </div>
      </aside>
      <section className="tv-stage" aria-label="Player TV">
        <div className="tv-screen">{active ? <iframe key={active.id} src={active.src} title={`Assistir ${active.nome}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : <div className="tv-screen__empty"><span aria-hidden="true">▷</span><h2>Seu próximo canal<br />está aqui.</h2><p>Escolha um canal na lista para começar.</p></div>}</div>
        <div className="tv-now"><div><p className="module-kicker">{active ? 'AGORA NA SUA TELA' : 'PRONTO PARA ASSISTIR'}</p><h2>{active?.nome || 'Escolha o que combina com você'}</h2><p>{active?.category || 'Explore as categorias ou encontre seus favoritos.'}</p></div>{active && <a className="module-button" href={active.src} target="_blank" rel="noopener noreferrer">Abrir player ↗</a>}</div>
        <p className="module-note">Pesquise sem interromper a transmissão. A reprodução depende da disponibilidade do canal.</p>
      </section>
    </div>
  </main>;
}
