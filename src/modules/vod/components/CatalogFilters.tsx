import type { GenreOption } from "../types/media";
import { NETWORK_OPTIONS } from "../lib/constants";

interface Props {
  search: string; onSearchChange: (v: string) => void;
  genreFilter: string; onGenreChange: (v: string) => void; genreOptions: GenreOption[];
  yearFilter: string; onYearChange: (v: string) => void;
  statusFilter: string; onStatusChange: (v: string) => void;
  networkFilter: string; onNetworkChange: (v: string) => void;
  ratingFilter: string; onRatingChange: (v: string) => void;
  sortOrder: string; onSortChange: (v: string) => void;
  typeFilter: string; onTypeChange: (v: string) => void; typeLocked: boolean;
  onClear: () => void; panelOpen: boolean; onTogglePanel: () => void;
  status?: string; page: number; pages: number; onPageChange: (v: number) => void;
  searching: boolean; error: string; remoteResults: boolean;
}

export function CatalogFilters(p: Props) {
  const activeCount = [p.genreFilter !== 'all', !!p.yearFilter, !!p.ratingFilter, p.statusFilter !== 'all', p.networkFilter !== 'all'].filter(Boolean).length;
  return <section className="vod-search" aria-label="Pesquisa avançada VOD">
    <header className="module-heading"><div><p className="module-kicker">HISTÓRIAS PARA O SEU MOMENTO</p><h1>Encontre sua próxima história.</h1></div></header>
    <div className="vod-search__bar">
      <label className="module-field vod-search__query"><span>Pesquisar no VOD</span><input type="search" placeholder="Busque filmes, séries e muito mais…" value={p.search} onChange={e => p.onSearchChange(e.target.value)} /></label>
      <label className="module-field"><span>Tipo</span><select value={p.typeFilter} disabled={p.typeLocked} onChange={e => p.onTypeChange(e.target.value)}><option value="all">Todos os títulos</option><option value="movie">Filmes</option><option value="serie">Séries</option><option value="anime">Animes</option><option value="dorama">Doramas</option></select></label>
      <label className="module-field"><span>Ordenar por</span><select value={p.sortOrder} onChange={e => p.onSortChange(e.target.value)}><option value="relevance">Relevância</option><option value="popularity">Popularidade</option><option value="release">Lançamento</option><option value="rating">Melhor avaliação</option><option value="title">Título A → Z</option></select></label>
      <button className={'module-button' + (p.panelOpen ? ' is-selected' : '')} aria-expanded={p.panelOpen} aria-controls="vod-filters" onClick={p.onTogglePanel}>Filtros{activeCount ? ` (${activeCount})` : ''}</button>
    </div>
    {p.panelOpen && <div id="vod-filters" className="vod-search__filters">
      <label className="module-field"><span>Gênero</span><select value={p.genreFilter} onChange={e => p.onGenreChange(e.target.value)}><option value="all">Todos os gêneros</option>{p.genreOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select></label>
      <label className="module-field"><span>Ano de lançamento</span><input type="number" min="1900" max="2100" placeholder="Qualquer ano" value={p.yearFilter} onChange={e => p.onYearChange(e.target.value)} /></label>
      <label className="module-field"><span>Nota mínima</span><select value={p.ratingFilter} onChange={e => p.onRatingChange(e.target.value)}><option value="">Todas as notas</option>{[5,6,7,8,9].map(n => <option key={n} value={n}>{n}+ / 10</option>)}</select></label>
      <label className="module-field"><span>Situação</span><select value={p.statusFilter} onChange={e => p.onStatusChange(e.target.value)}><option value="all">Todas</option><option value="finished">Finalizada</option><option value="ongoing">Em andamento</option></select></label>
      <label className="module-field"><span>Emissora / produtora</span><select value={p.networkFilter} onChange={e => p.onNetworkChange(e.target.value)}><option value="all">Todas</option>{NETWORK_OPTIONS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}</select></label>
      <button className="module-text-button" onClick={p.onClear}>Limpar filtros</button>
    </div>}
    <div className="vod-search__feedback"><p className="module-status" role="status">{p.error || (p.searching ? 'Pesquisando…' : p.status)}</p>{p.remoteResults && <nav className="search-pagination" aria-label="Páginas da pesquisa"><button className="module-button" disabled={p.page <= 1 || p.searching} onClick={() => p.onPageChange(p.page - 1)}>← Anterior</button><span>Página {p.page} de {p.pages}</span><button className="module-button" disabled={p.page >= p.pages || p.searching} onClick={() => p.onPageChange(p.page + 1)}>Próxima →</button></nav>}</div>
    {(p.remoteResults || activeCount > 0) && <p className="module-note">Filtros e ordenação refinam os títulos da página carregada. Explore as próximas páginas para mais resultados. Emissora/produtora não indica disponibilidade em streaming.</p>}
  </section>;
}
