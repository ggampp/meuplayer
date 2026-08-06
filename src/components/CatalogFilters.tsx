import { createPortal } from "react-dom";
import type { GenreOption } from "../types/media";
import { NETWORK_OPTIONS } from "../lib/constants";

export interface CatalogFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  genreFilter: string;
  onGenreChange: (value: string) => void;
  genreOptions: GenreOption[];
  status?: string;
  yearFilter: string;
  onYearChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  networkFilter: string;
  onNetworkChange: (value: string) => void;
  onClear: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export function CatalogFilters({
  search,
  onSearchChange,
  genreFilter,
  onGenreChange,
  genreOptions,
  yearFilter,
  onYearChange,
  statusFilter,
  onStatusChange,
  networkFilter,
  onNetworkChange,
  onClear,
  panelOpen,
  onTogglePanel,
}: CatalogFiltersProps) {
  const slot = document.getElementById("catalogFilters");

  const activeCount =
    (search.trim() ? 1 : 0) +
    (genreFilter !== "all" ? 1 : 0) +
    (yearFilter ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (networkFilter !== "all" ? 1 : 0);

  return (
    <>
      {slot
        ? createPortal(
            <div className="app-nav__filters-inner">
              <button
                type="button"
                className={`filter-toggle${panelOpen ? " filter-toggle--open" : ""}`}
                onClick={onTogglePanel}
                aria-expanded={panelOpen}
                aria-controls="filterPanel"
              >
                <span className="filter-toggle__icon" aria-hidden="true">
                  ☰
                </span>
                <span>Filtros</span>
                {activeCount > 0 ? (
                  <span className="filter-toggle__badge">{activeCount}</span>
                ) : null}
              </button>
            </div>,
            slot
          )
        : null}
      <aside
        id="filterPanel"
        className={`filter-panel${panelOpen ? " filter-panel--open" : ""}`}
        aria-hidden={!panelOpen}
        aria-label="Filtros do catálogo"
      >
        <div className="filter-panel__overlay" onClick={onTogglePanel} />
        <div className="filter-panel__drawer" role="dialog" aria-modal="true">
          <div className="filter-panel__header">
            <h2 className="filter-panel__title">Filtros</h2>
            <button
              type="button"
              className="filter-panel__close"
              onClick={onTogglePanel}
              aria-label="Fechar filtros"
            >
              ×
            </button>
          </div>

          <div className="filter-panel__body">
            <label className="filters__field">
              <span>Nome</span>
              <input
                type="search"
                placeholder="Título, ID, original"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>

            <label className="filters__field">
              <span>Ano de lançamento</span>
              <input
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                placeholder="Ex.: 2024"
                value={yearFilter}
                onChange={(event) => onYearChange(event.target.value)}
              />
            </label>

            <label className="filters__field">
              <span>Situação</span>
              <select
                value={statusFilter}
                onChange={(event) => onStatusChange(event.target.value)}
              >
                <option value="all">Todas</option>
                <option value="finished">Finalizada</option>
                <option value="ongoing">Em andamento</option>
              </select>
            </label>

            <label className="filters__field">
              <span>Emissora</span>
              <select
                value={networkFilter}
                onChange={(event) => onNetworkChange(event.target.value)}
              >
                <option value="all">Todas</option>
                {NETWORK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filters__field">
              <span>Gênero</span>
              <select
                value={genreFilter}
                onChange={(event) => onGenreChange(event.target.value)}
              >
                <option value="all">Todos os gêneros</option>
                {genreOptions.map((genre) => (
                  <option key={genre.value} value={genre.value}>
                    {genre.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-panel__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClear}
              disabled={activeCount === 0}
            >
              Limpar filtros
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onTogglePanel}
            >
              Aplicar
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
