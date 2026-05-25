const { useEffect, useMemo, useState, useRef } = React;

const API_BASE = "";
const categories = [
  { key: "movie", label: "Filmes", eyebrow: "Cinema" },
  { key: "serie", label: "Séries", eyebrow: "Live action" },
  { key: "anime", label: "Animes", eyebrow: "Animação" },
  { key: "dorama", label: "Doramas", eyebrow: "K-Drama", dedicated: true },
];

const IMAGE_BASE = "/api/image/tmdb/w500";
const BACKDROP_BASE = "/api/image/tmdb/w1280";
const STILL_BASE = "/api/image/tmdb/w780";
const PROFILE_BASE = "/api/image/tmdb/w185";
const ROUTE_TO_TYPE = {
  filme: "movie",
  serie: "serie",
  anime: "anime",
  dorama: "dorama",
};

function getRouteTypeFromPath(pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  return ROUTE_TO_TYPE[firstSegment] || null;
}

const ROUTE_TYPE = window.MEUPLAYER_ROUTE || getRouteTypeFromPath(window.location.pathname);

function mediaTypeToRoute(type) {
  if (type === "movie") return "filme";
  if (type === "anime") return "anime";
  if (type === "dorama") return "dorama";
  return "serie";
}

function tmdbAppType(type) {
  if (type === "movie") return "movie";
  return "serie";
}

const META_BATCH_CHUNK = 25;

async function fetchMetaBatch(type, ids) {
  if (!ids.length) return {};
  const unique = [...new Set(ids.map(String))];
  const merged = {};
  for (let offset = 0; offset < unique.length; offset += META_BATCH_CHUNK) {
    const chunk = unique.slice(offset, offset + META_BATCH_CHUNK);
    const query = new URLSearchParams({
      type: tmdbAppType(type),
      ids: chunk.join(","),
    });
    const data = await fetchJson(`/api/media/meta/batch?${query.toString()}`);
    const items = data.items || {};
    Object.assign(merged, items);
  }
  return merged;
}

function fetchJson(path) {
  return fetch(`${API_BASE}${path}`).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail || data.error || "Falha na API";
      throw new Error(detail);
    }
    return data;
  });
}

function normalizeList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(String);
  if (Array.isArray(data.results)) return data.results.map(String);
  if (Array.isArray(data.items)) return data.items.map(String);
  if (Array.isArray(data.ids)) return data.ids.map(String);
  return Object.values(data)
    .flat()
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map(String);
}

function buildPlayerUrl({ id, type, season, episode, provider }) {
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

const ANIMATION_GENRE_ID = 16;

function isAnimationTv(meta) {
  if (!meta) return false;
  const genreIds = [...(meta.genre_ids || [])];
  (meta.genres || []).forEach((genre) => {
    genreIds.push(genre.id ?? genre);
  });
  return genreIds.includes(ANIMATION_GENRE_ID);
}

function emptyCatalog() {
  return { movie: [], serie: [], anime: [], dorama: [] };
}

function categoriesForTypeFilter(typeFilter) {
  if (typeFilter === "all") return categories.filter((c) => !c.dedicated);
  return categories.filter((category) => category.key === typeFilter);
}

function buildDiscoverParams(apiType, { genreId, page = "1" } = {}) {
  const params = new URLSearchParams({ type: apiType, page });
  if (genreId) params.set("genre", genreId);
  return params;
}

function applyDiscoverItems(nextResults, nextMeta, items, options = {}) {
  const { onlyType, tvAs } = options;
  items.filter(isVisibleMedia).forEach((item) => {
    const id = String(item.id);
    let type = "movie";
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

function isReleased(meta) {
  if (!meta) return true;
  const dateText = meta.release_date || meta.first_air_date;
  if (!dateText) return true;
  const parsed = Date.parse(dateText);
  if (!parsed) return true;
  return parsed <= Date.now();
}

function isAdultMedia(meta) {
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

function isVisibleMedia(meta) {
  return isReleased(meta) && !isAdultMedia(meta);
}

function pickYear(meta) {
  return (meta?.release_date || meta?.first_air_date || "").slice(0, 4);
}

function typeLabel(type) {
  if (type === "movie") return "Filme";
  if (type === "anime") return "Anime";
  if (type === "dorama") return "Dorama";
  return "Série";
}

function seasonListFromMeta(meta) {
  if (!meta?.seasons) return [];
  return meta.seasons
    .filter((season) => season.season_number !== 0)
    .sort((a, b) => a.season_number - b.season_number);
}

function hasMultipleSeasons(meta) {
  const list = seasonListFromMeta(meta);
  if (list.length > 1) return true;
  const count = Number(meta?.number_of_seasons);
  return Number.isFinite(count) && count > 1;
}

/** Busca/discover trazem meta sem `seasons`; detalhe TMDB traz a lista completa. */
function needsFullSeriesMeta(meta, type) {
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

function episodesFromSeasonData(seasonData) {
  return (seasonData?.episodes || [])
    .filter((episode) => episode.episode_number != null)
    .sort((a, b) => a.episode_number - b.episode_number);
}

function MediaCard({ item, meta, onSelect, compact = false }) {
  const displayTitle =
    meta?.title ||
    meta?.name ||
    meta?.original_title ||
    meta?.original_name ||
    item.id;
  const originalTitle =
    meta?.original_title || meta?.original_name || displayTitle;
  const year = pickYear(meta);
  const posterPath = meta?.poster_path ? `${IMAGE_BASE}${meta.poster_path}` : "";
  const overview = meta?.overview || "Sinopse não disponível.";
  const sameTitle = originalTitle === displayTitle;

  return (
    <button
      type="button"
      className={`card${compact ? " card--compact" : ""}`}
      onClick={() => onSelect(item)}
      aria-label={`Abrir ${displayTitle}`}
    >
      <div className="card__media">
        {posterPath ? (
          <img src={posterPath} alt={displayTitle} loading="lazy" />
        ) : (
          <span className="card__placeholder">Sem capa</span>
        )}
      </div>
      <div className="card__veil">
        <h3 className="card__title">{displayTitle}</h3>
        <span className="card__meta">
          {typeLabel(item.type)}
          {year ? ` · ${year}` : ""}
          {!sameTitle ? ` · ${originalTitle}` : ""}
        </span>
        {!compact ? (
          <p className="card__overview">{overview}</p>
        ) : null}
        <span className="card__cta">Abrir →</span>
      </div>
    </button>
  );
}

function GridRow({ title, eyebrow, status, items, onSelect, hasMore, onMore }) {
  return (
    <section className="row" aria-labelledby={`row-${title}`}>
      <header className="row__header">
        <h2 className="row__title" id={`row-${title}`}>
          {title}
        </h2>
        <span className="row__status">{eyebrow}</span>
      </header>
      <div className="row__grid">
        {items.length ? (
          items.map((item) => (
            <MediaCard
              key={`${item.type}-${item.id}`}
              item={item}
              meta={item.meta || {}}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="row__empty">{status || "Nenhum item encontrado."}</div>
        )}
      </div>
      {hasMore ? (
        <button type="button" className="row__more" onClick={onMore}>
          Mais {title.toLowerCase()}
        </button>
      ) : null}
    </section>
  );
}

function CastCard({ member, onClick }) {
  const profileUrl = member.profile_path ? `${PROFILE_BASE}${member.profile_path}` : null;
  return (
    <button className="cast-card" type="button" onClick={onClick}>
      <div className="cast-card__photo">
        {profileUrl
          ? <img src={profileUrl} alt={member.name} loading="lazy" />
          : <span className="cast-card__initials">{(member.name || "?").charAt(0)}</span>}
      </div>
      <p className="cast-card__name">{member.name}</p>
      {member.character ? <p className="cast-card__role">{member.character}</p> : null}
    </button>
  );
}

function formatPersonMeta(details) {
  if (!details) return [];
  const lines = [];
  if (details.birthday) {
    const born = details.deathday
      ? `${details.birthday} — ${details.deathday}`
      : details.birthday;
    lines.push(`Nascimento: ${born}`);
  }
  if (details.place_of_birth) lines.push(details.place_of_birth);
  if (details.known_for_department) lines.push(details.known_for_department);
  return lines;
}

function KnownForCard({ work, onSelect }) {
  const meta = work.meta || {};
  const title = meta.title || meta.name || work.id;
  const posterUrl = meta.poster_path ? `${IMAGE_BASE}${meta.poster_path}` : null;
  const role = meta.character || meta.job || null;
  return (
    <button type="button" className="known-for-card" onClick={() => onSelect(work)}>
      <div className="known-for-card__poster">
        {posterUrl
          ? <img src={posterUrl} alt={title} loading="lazy" />
          : <span className="cast-card__initials">{(title || "?").charAt(0)}</span>}
      </div>
      <p className="known-for-card__title">{title}</p>
      {role ? <p className="known-for-card__role">{role}</p> : null}
    </button>
  );
}

function PersonDetail({ person, data, hasParentDetail, onBack, onSelectWork }) {
  const profileUrl = person.profile_path ? `${IMAGE_BASE}${person.profile_path}` : null;
  const details = data ? data.details : null;
  const works = data ? data.works : [];
  const loading = !data;
  const metaLines = formatPersonMeta(details);
  const biography = details?.biography?.trim() || "";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [person.id]);

  return (
    <main>
      <article className="detail detail--person">
        <div className="detail__content">
          <button type="button" className="detail__back" onClick={onBack}>
            {hasParentDetail ? "← Voltar ao título" : "← Voltar ao catálogo"}
          </button>

          <div className="detail__layout">
            <div
              className="detail__poster detail__poster--profile"
              style={profileUrl ? { backgroundImage: `url(${profileUrl})` } : undefined}
            >
              {!profileUrl ? (
                <span className="cast-card__initials">{(person.name || "?").charAt(0)}</span>
              ) : null}
            </div>

            <div className="detail__info detail__info--person">
              <h1 className="detail__title">{person.name}</h1>
              {person.character ? (
                <p className="detail__subtitle">Como {person.character}</p>
              ) : null}

              {metaLines.length ? (
                <div className="detail__meta detail__meta--stacked">
                  {metaLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              ) : null}

              <div className="detail__bio-block">
                <h2 className="detail__bio-heading">Biografia</h2>
                {loading ? (
                  <p className="detail__overview">Carregando biografia…</p>
                ) : (
                  <p className="detail__overview">
                    {biography || "Biografia não disponível."}
                  </p>
                )}
              </div>
            </div>
          </div>

          <section className="detail__section">
            <div className="detail__section-heading">
              <h2 className="detail__section-title">Conhecido(a) por</h2>
            </div>
            {loading ? (
              <p className="detail__section-status">Carregando obras…</p>
            ) : works.length ? (
              <div className="known-for-scroll">
                {works.map((work) => (
                  <KnownForCard
                    key={`${work.type}-${work.id}`}
                    work={work}
                    onSelect={onSelectWork}
                  />
                ))}
              </div>
            ) : (
              <p className="detail__section-status">Nenhuma obra com capa encontrada.</p>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}

const NETWORK_OPTIONS = [
  { value: "netflix", label: "Netflix", match: ["netflix"] },
  { value: "prime", label: "Prime Video", match: ["amazon", "prime video"] },
  { value: "hbo", label: "HBO / Max", match: ["hbo", "max original", "warner"] },
  { value: "disney", label: "Disney+", match: ["disney", "star+", "hulu"] },
  { value: "apple", label: "Apple TV+", match: ["apple"] },
  { value: "globoplay", label: "Globoplay", match: ["globo"] },
  { value: "paramount", label: "Paramount+", match: ["paramount"] },
];

function itemMatchesNetwork(meta, networkValue) {
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

function itemMatchesStatus(meta, type, statusValue) {
  if (!statusValue || statusValue === "all") return true;
  const status = String(meta?.status || "").toLowerCase();
  const isMovie = type === "movie";
  const finished = isMovie
    ? status === "released" || (!status && meta?.release_date)
    : ["ended", "canceled", "cancelled"].includes(status);
  if (statusValue === "finished") return finished;
  if (statusValue === "ongoing") return !finished;
  return true;
}

function itemMatchesYear(meta, yearValue) {
  if (!yearValue) return true;
  const year = String(yearValue).trim();
  if (!year) return true;
  const date = meta?.release_date || meta?.first_air_date || "";
  return date.startsWith(year);
}

function CatalogFilters({
  search,
  onSearchChange,
  genreFilter,
  onGenreChange,
  genreOptions,
  status,
  yearFilter,
  onYearChange,
  statusFilter,
  onStatusChange,
  networkFilter,
  onNetworkChange,
  onClear,
  panelOpen,
  onTogglePanel,
}) {
  const slot = document.getElementById("catalogFilters");

  const activeCount =
    (search.trim() ? 1 : 0) +
    (genreFilter !== "all" ? 1 : 0) +
    (yearFilter ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (networkFilter !== "all" ? 1 : 0);

  return (
    <>
      {slot ? ReactDOM.createPortal(
        <div className="app-nav__filters-inner">
          <button
            type="button"
            className={`filter-toggle${panelOpen ? " filter-toggle--open" : ""}`}
            onClick={onTogglePanel}
            aria-expanded={panelOpen}
            aria-controls="filterPanel"
          >
            <span className="filter-toggle__icon" aria-hidden="true">☰</span>
            <span>Filtros</span>
            {activeCount > 0 ? (
              <span className="filter-toggle__badge">{activeCount}</span>
            ) : null}
          </button>
        </div>,
        slot
      ) : null}
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
                min="1900"
                max="2100"
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

function Hero({ featured, onWatch }) {
  if (!featured) {
    return (
      <section className="hero" aria-label="Destaque">
        <div className="hero__bloom" aria-hidden="true" />
        <p className="hero__eyebrow">MeuPlayer</p>
        <h1 className="hero__title">
          Um cinema <em>pessoal</em>, sem alarde.
        </h1>
        <p className="hero__subtitle">
          Filmes, séries e animes do TMDB tocados via SuperFlix — sem
          recomendações forçadas, sem perfis, sem anúncios.
        </p>
      </section>
    );
  }

  const meta = featured.meta || {};
  const title = meta.title || meta.name || featured.id;
  const year = pickYear(meta);
  const overview = meta.overview || "";
  const backdropPath = meta.backdrop_path
    ? `${BACKDROP_BASE}${meta.backdrop_path}`
    : "";
  const backdropStyle = backdropPath
    ? { backgroundImage: `url(${backdropPath})` }
    : undefined;

  return (
    <section className="hero" aria-label="Destaque do catálogo">
      <div className="hero__backdrop" style={backdropStyle} aria-hidden="true" />
      <div className="hero__bloom" aria-hidden="true" />
      <p className="hero__eyebrow">
        {typeLabel(featured.type)}
        {year ? ` · ${year}` : ""}
      </p>
      <h1 className="hero__title">{title}</h1>
      {overview ? (
        <p className="hero__subtitle">
          {overview.length > 220 ? overview.slice(0, 220) + "…" : overview}
        </p>
      ) : null}
      <div className="hero__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onWatch(featured)}
        >
          Abrir detalhes
        </button>
      </div>
    </section>
  );
}

function App() {
  const typeFilter = ROUTE_TYPE || "all";
  const [lists, setLists] = useState({});
  const [status, setStatus] = useState("Carregando...");
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [genres, setGenres] = useState({ movie: [], tv: [] });
  const [searchResults, setSearchResults] = useState(null);
  const [genreResults, setGenreResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [displayCounts, setDisplayCounts] = useState({
    movie: 10,
    serie: 10,
    anime: 10,
  });
  const [modal, setModal] = useState({ open: false, id: "", type: "movie" });
  const [modalSeason, setModalSeason] = useState("1");
  const [modalEpisode, setModalEpisode] = useState("1");
  const [modalChromeVisible, setModalChromeVisible] = useState(true);
  const [playerProvider, setPlayerProvider] = useState("superflix");
  const [metaMap, setMetaMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [seasonData, setSeasonData] = useState(null);
  const [modalSeasonData, setModalSeasonData] = useState(null);
  const [relatedItems, setRelatedItems] = useState([]);
  const [castData, setCastData] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personData, setPersonData] = useState(null);
  const [doramaItems, setDoramaItems] = useState([]);
  const [doramaPage, setDoramaPage] = useState(1);
  const [doramaHasMore, setDoramaHasMore] = useState(false);
  const [doramaLoading, setDoramaLoading] = useState(false);
  const [tmdbConfigured, setTmdbConfigured] = useState(null);
  const metaMapRef = useRef({});
  const modalChromeTimerRef = useRef(null);

  useEffect(() => {
    metaMapRef.current = metaMap;
  }, [metaMap]);

  useEffect(() => {
    document.body.classList.toggle("filters-open", filterPanelOpen);
    return () => document.body.classList.remove("filters-open");
  }, [filterPanelOpen]);

  const hideModalChromeSoon = (delay = 3200) => {
    if (modalChromeTimerRef.current) {
      clearTimeout(modalChromeTimerRef.current);
    }
    modalChromeTimerRef.current = setTimeout(() => {
      setModalChromeVisible(false);
    }, delay);
  };

  const revealModalChrome = () => {
    setModalChromeVisible(true);
    hideModalChromeSoon();
  };

  const keepModalChromeVisible = () => {
    if (modalChromeTimerRef.current) {
      clearTimeout(modalChromeTimerRef.current);
    }
    setModalChromeVisible(true);
  };

  useEffect(() => {
    if (!modal.open) {
      if (modalChromeTimerRef.current) {
        clearTimeout(modalChromeTimerRef.current);
      }
      setModalChromeVisible(true);
      return;
    }
    revealModalChrome();
    return () => {
      if (modalChromeTimerRef.current) {
        clearTimeout(modalChromeTimerRef.current);
      }
    };
  }, [modal.open, modal.id, modal.type]);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setTmdbConfigured(Boolean(data.hasTmdbKey)))
      .catch(() => setTmdbConfigured(false));
  }, []);

  useEffect(() => {
    function onRemoteSearch(event) {
      const term = String(event.detail?.term || '');
      setSearch(term);
    }
    window.addEventListener('meuplayer:remote-search', onRemoteSearch);
    return () => window.removeEventListener('meuplayer:remote-search', onRemoteSearch);
  }, []);

  useEffect(() => {
    fetchJson("/api/media/stored?limit=120")
      .then((data) => {
        const items = data.items || [];
        if (!items.length) return;
        setMetaMap((prev) => {
          const next = { ...prev };
          items.forEach((item) => {
            if (item?.id && item?.meta) {
              next[`${item.type}-${item.id}`] = item.meta;
            }
          });
          return next;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setGenreFilter("all");
  }, [typeFilter]);

  useEffect(() => {
    setDisplayCounts({ movie: 10, serie: 10, anime: 10 });
  }, [typeFilter, genreFilter]);

  useEffect(() => {
    Promise.all([
      fetchJson("/api/tmdb/genres?type=movie").catch(() => ({ genres: [] })),
      fetchJson("/api/tmdb/genres?type=tv").catch(() => ({ genres: [] })),
    ]).then(([movieGenres, tvGenres]) => {
      setGenres({
        movie: movieGenres.genres || [],
        tv: tvGenres.genres || [],
      });
    });
  }, []);

  useEffect(() => {
    if (ROUTE_TYPE !== "dorama") return;
    let active = true;
    setDoramaLoading(true);
    fetchJson(
      `/api/tmdb/discover?type=tv&original_language=ko&sort=popularity&page=${doramaPage}`
    )
      .then((data) => {
        if (!active) return;
        const items = (data.results || []).filter(isVisibleMedia).map((item) => ({
          id: String(item.id),
          type: "dorama",
          meta: item,
        }));
        setDoramaItems((prev) => (doramaPage === 1 ? items : [...prev, ...items]));
        setDoramaHasMore((data.page || 1) < (data.total_pages || 1));
        setMetaMap((prev) => {
          const next = { ...prev };
          items.forEach((item) => {
            next[`dorama-${item.id}`] = item.meta;
          });
          return next;
        });
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (active) setDoramaLoading(false);
      });
    return () => {
      active = false;
    };
  }, [doramaPage]);

  useEffect(() => {
    if (search.trim().length >= 2) return;
    if (ROUTE_TYPE === "dorama") return;

    let active = true;

    async function loadCatalog() {
      setLoadingCatalog(true);
      setStatus("Carregando...");
      setGenreResults(null);

      try {
        if (genreFilter !== "all") {
          const [filterType, filterId] = genreFilter.split(":");
          const apiType = filterType === "movie" ? "movie" : "tv";
          const discoverParams = buildDiscoverParams(apiType, {
            genreId: filterId,
          });
          const data = await fetchJson(
            `/api/tmdb/discover?${discoverParams.toString()}`
          );
          if (!active) return;

          const nextResults = emptyCatalog();
          const nextMeta = {};
          const options = { tvAs: apiType === "tv" };
          if (typeFilter === "anime") options.onlyType = "anime";
          else if (typeFilter === "serie") options.onlyType = "serie";
          else if (typeFilter === "movie") options.onlyType = "movie";

          applyDiscoverItems(
            nextResults,
            nextMeta,
            (data?.results || []).slice(0, 50),
            options
          );
          setMetaMap((prev) => ({ ...prev, ...nextMeta }));
          setGenreResults(nextResults);
          setStatus("Catálogo atualizado");
          return;
        }

        const categoriesToFetch = categoriesForTypeFilter(typeFilter);
        const results = await Promise.all(
          categoriesToFetch.map((category) =>
            fetchJson(
              `/api/lista?category=${category.key}&type=tmdb&format=json&order=desc`
            ).then(normalizeList)
          )
        );
        if (!active) return;

        const next = emptyCatalog();
        categoriesToFetch.forEach((category, index) => {
          next[category.key] = results[index];
        });
        setLists(next);
        setStatus("Catálogo atualizado");
      } catch (error) {
        console.error(error);
        if (active) setStatus("Erro ao carregar catálogo");
      } finally {
        if (active) setLoadingCatalog(false);
      }
    }

    loadCatalog();
    return () => {
      active = false;
    };
  }, [typeFilter, genreFilter, search]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      const requests = [];
      if (typeFilter === "movie") {
        requests.push(
          fetchJson(`/api/tmdb/search?type=movie&query=${encodeURIComponent(term)}`)
            .then((data) => ({ type: "movie", data }))
        );
      } else if (typeFilter === "serie" || typeFilter === "anime" || typeFilter === "dorama") {
        requests.push(
          fetchJson(`/api/tmdb/search?type=tv&query=${encodeURIComponent(term)}`)
            .then((data) => ({ type: "tv", data }))
        );
      } else {
        requests.push(
          fetchJson(`/api/tmdb/search?type=movie&query=${encodeURIComponent(term)}`)
            .then((data) => ({ type: "movie", data }))
        );
        requests.push(
          fetchJson(`/api/tmdb/search?type=tv&query=${encodeURIComponent(term)}`)
            .then((data) => ({ type: "tv", data }))
        );
      }

      Promise.all(requests)
        .then((results) => {
          if (!active) return;
          const nextResults = emptyCatalog();
          const nextMeta = {};
          results.forEach((result) => {
            const items = (result.data?.results || []).slice(0, 50).filter(isVisibleMedia);
            if (result.type === "movie") {
              nextResults.movie = items.map((item) => ({
                id: String(item.id),
                type: "movie",
                meta: item,
              }));
              items.forEach((item) => {
                nextMeta[`movie-${item.id}`] = item;
              });
            } else {
              const targetType =
                typeFilter === "anime" ? "anime" : typeFilter === "dorama" ? "dorama" : "serie";
              const filteredItems =
                targetType === "dorama"
                  ? items.filter((item) => item.original_language === "ko")
                  : items;
              nextResults[targetType] = filteredItems.map((item) => ({
                id: String(item.id),
                type: targetType,
                meta: item,
              }));
              filteredItems.forEach((item) => {
                nextMeta[`${targetType}-${item.id}`] = item;
              });
            }
          });
          setMetaMap((prev) => ({ ...prev, ...nextMeta }));
          setSearchResults(nextResults);
        })
        .catch((error) => {
          console.error(error);
          if (active) setSearchResults({ movie: [], serie: [], anime: [] });
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, typeFilter]);

  useEffect(() => {
    const sourceLists = searchResults || genreResults || lists;
    const pendingByType = {};
    const currentMeta = metaMapRef.current;

    categories.forEach((category) => {
      const list = sourceLists[category.key] || [];
      const limit = displayCounts[category.key] || 10;
      list.slice(0, limit).forEach((entry) => {
        const id = typeof entry === "object" ? entry.id : entry;
        if (!id) return;
        const itemType = typeof entry === "object" ? entry.type || category.key : category.key;
        const key = `${itemType}-${id}`;
        if (currentMeta[key]) return;
        if (!pendingByType[itemType]) pendingByType[itemType] = [];
        pendingByType[itemType].push(String(id));
      });
    });

    const requests = Object.entries(pendingByType)
      .filter(([, ids]) => ids.length)
      .map(([type, ids]) =>
        fetchMetaBatch(type, ids).then((items) => ({ type, items }))
      );

    if (!requests.length) return;

    let cancelled = false;
    Promise.all(requests)
      .then((results) => {
        if (cancelled) return;
        setMetaMap((prev) => {
          const next = { ...prev };
          results.forEach(({ type, items }) => {
            Object.entries(items).forEach(([id, data]) => {
              if (!data) return;
              next[`${type}-${id}`] = data;
            });
          });
          return next;
        });
      })
      .catch((error) => {
        console.error("Falha ao carregar metadados:", error);
        setStatus((prev) =>
          prev.includes("TMDB") ? prev : `${error.message || "Erro ao carregar capas"}`
        );
      });

    return () => {
      cancelled = true;
    };
  }, [lists, searchResults, genreResults, displayCounts]);

  const selectedMeta = useMemo(() => {
    if (!selected) return null;
    return metaMap[`${selected.type}-${selected.id}`] || null;
  }, [selected, metaMap]);

  const seasonList = useMemo(
    () => seasonListFromMeta(selectedMeta),
    [selectedMeta]
  );

  const modalMeta = useMemo(() => {
    if (!modal.id) return null;
    return metaMap[`${modal.type}-${modal.id}`] || null;
  }, [metaMap, modal.id, modal.type]);

  const modalSeasonList = useMemo(
    () => seasonListFromMeta(modalMeta),
    [modalMeta]
  );

  const modalEpisodes = useMemo(
    () => episodesFromSeasonData(modalSeasonData),
    [modalSeasonData]
  );

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const sourceLists =
      searchResults ||
      genreResults ||
      (ROUTE_TYPE === "dorama" ? { ...emptyCatalog(), dorama: doramaItems } : lists);
    const apiCatalog = Boolean(genreResults);
    const visibleCategories = ROUTE_TYPE
      ? categories.filter((category) => category.key === ROUTE_TYPE)
      : typeFilter === "all"
        ? categories
        : categories.filter((category) => category.key === typeFilter);
    return visibleCategories.map((category) => {
      let items =
        (sourceLists[category.key] || []).map((entry) => {
          if (typeof entry === "object") {
            return entry;
          }
          return {
            id: entry,
            type: category.key,
            meta: metaMap[`${category.key}-${entry}`],
          };
        }) || [];
      items = items.filter((item) => isVisibleMedia(item.meta));
      const limit = displayCounts[category.key] || 10;
      if (normalized && !searchResults) {
        items = items.filter((item) => {
          const meta = item.meta || {};
          const title =
            meta.title ||
            meta.name ||
            meta.original_title ||
            meta.original_name ||
            item.id;
          const original =
            meta.original_title || meta.original_name || "";
          return (
            title.toLowerCase().includes(normalized) ||
            original.toLowerCase().includes(normalized) ||
            item.id.toLowerCase().includes(normalized)
          );
        });
      }
      if (typeFilter !== "all") {
        items = items.filter((item) => item.type === typeFilter);
      }
      if (genreFilter !== "all" && !apiCatalog && category.key !== "dorama") {
        const [filterType, filterId] = genreFilter.split(":");
        items = items.filter((item) => {
          const meta = item.meta || {};
          const itemType = item.type === "movie" ? "movie" : "tv";
          if (itemType !== filterType) return false;
          const ids = (meta.genres || meta.genre_ids || []).map((genre) =>
            String(genre.id ?? genre)
          );
          return ids.includes(filterId);
        });
      }
      if (yearFilter) {
        items = items.filter((item) => itemMatchesYear(item.meta, yearFilter));
      }
      if (statusFilter !== "all") {
        items = items.filter((item) =>
          itemMatchesStatus(item.meta, item.type, statusFilter)
        );
      }
      if (networkFilter !== "all") {
        items = items.filter((item) =>
          itemMatchesNetwork(item.meta, networkFilter)
        );
      }
      if (category.key !== "dorama") {
        items = [...items].sort((a, b) => {
          const aDate = a.meta?.release_date || a.meta?.first_air_date || "";
          const bDate = b.meta?.release_date || b.meta?.first_air_date || "";
          return (Date.parse(bDate) || 0) - (Date.parse(aDate) || 0);
        });
      }
      const total = items.length;
      if (category.key !== "dorama") {
        items = items.slice(0, limit);
      }
      return {
        key: category.key,
        title: category.label,
        eyebrow: category.eyebrow,
        items,
        hasMore:
          category.key === "dorama"
            ? !searching && !searchResults && doramaHasMore
            : total > limit,
      };
    });
  }, [
    lists,
    metaMap,
    search,
    typeFilter,
    genreFilter,
    searchResults,
    genreResults,
    displayCounts,
    doramaItems,
    doramaHasMore,
    searching,
    yearFilter,
    statusFilter,
    networkFilter,
  ]);

  const featured = useMemo(() => {
    for (const row of filteredRows) {
      const candidate = row.items.find((item) => item.meta?.backdrop_path);
      if (candidate) return candidate;
    }
    return null;
  }, [filteredRows]);

  const genreOptions = useMemo(() => {
    if (typeFilter === "movie") {
      return genres.movie.map((genre) => ({
        value: `movie:${genre.id}`,
        label: genre.name,
      }));
    }
    if (typeFilter === "serie" || typeFilter === "anime" || typeFilter === "dorama") {
      return genres.tv.map((genre) => ({
        value: `tv:${genre.id}`,
        label: genre.name,
      }));
    }
    return [
      ...genres.movie.map((genre) => ({
        value: `movie:${genre.id}`,
        label: `${genre.name} (Filme)`,
      })),
      ...genres.tv.map((genre) => ({
        value: `tv:${genre.id}`,
        label: `${genre.name} (Série)`,
      })),
    ];
  }, [genres, typeFilter]);

  const openModal = (item, season = "1", episode = "1") => {
    setModal({ open: true, id: item.id, type: item.type });
    setModalSeason(season);
    setModalEpisode(episode);
    setPlayerProvider((prev) => prev || "superflix");
  };

  const closeModal = () => {
    setModal({ open: false, id: "", type: modal.type });
    setModalSeason("1");
    setModalEpisode("1");
    setModalSeasonData(null);
  };

  const ensureMeta = async (item) => {
    const key = `${item.type}-${item.id}`;
    const existing = metaMap[key];
    if (existing && !needsFullSeriesMeta(existing, item.type)) {
      return existing;
    }
    try {
      const data = await fetchJson(`/api/tmdb?type=${item.type}&id=${item.id}`);
      setMetaMap((prev) => ({ ...prev, [key]: data }));
      return data;
    } catch (error) {
      console.error(error);
      return existing || null;
    }
  };

  const syncUrl = (item, replace = false) => {
    const path = item && item.id
      ? `/${mediaTypeToRoute(item.type)}/${item.id}`
      : ROUTE_TYPE
        ? `/${mediaTypeToRoute(ROUTE_TYPE)}`
        : "/";
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
  };

  const openDetail = (item) => {
    setSelected(item);
    ensureMeta(item);
    syncUrl(item);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const closeDetail = () => {
    setSelected(null);
    syncUrl(null, true);
  };

  const closePerson = () => {
    setSelectedPerson(null);
    setPersonData(null);
  };

  const openWorkFromPerson = (item) => {
    closePerson();
    openDetail(item);
  };

  useEffect(() => {
    if (!selected || selected.type === "movie") {
      setSeasonNumber("1");
      setSeasonData(null);
      setRelatedItems([]);
      return;
    }
    const firstSeason = seasonList[0]?.season_number;
    if (firstSeason) {
      setSeasonNumber(String(firstSeason));
    }
  }, [selected, seasonList]);

  useEffect(() => {
    if (!selected || selected.type === "movie") return;
    if (!seasonNumber) return;
    fetchJson(`/api/tmdb/season?id=${selected.id}&season=${seasonNumber}`)
      .then((data) => setSeasonData(data))
      .catch((error) => {
        console.error(error);
        setSeasonData(null);
      });
  }, [selected, seasonNumber]);

  useEffect(() => {
    if (!modal.open || modal.type === "movie" || !modal.id) {
      setModalSeasonData(null);
      return;
    }

    let cancelled = false;
    ensureMeta({ id: modal.id, type: modal.type }).then((meta) => {
      if (cancelled || !meta) return;
      const seasons = seasonListFromMeta(meta);
      if (!seasons.length) return;
      const seasonValid = seasons.some(
        (season) => String(season.season_number) === String(modalSeason)
      );
      if (!seasonValid) {
        setModalSeason(String(seasons[0].season_number));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modal.open, modal.id, modal.type]);

  useEffect(() => {
    if (!modal.open || modal.type === "movie" || !modal.id || !modalSeason) {
      setModalSeasonData(null);
      return;
    }

    let cancelled = false;
    fetchJson(`/api/tmdb/season?id=${modal.id}&season=${modalSeason}`)
      .then((data) => {
        if (!cancelled) setModalSeasonData(data);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setModalSeasonData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [modal.open, modal.id, modal.type, modalSeason]);

  useEffect(() => {
    if (!modal.open || modal.type === "movie" || !modalEpisodes.length) return;
    const episodeValid = modalEpisodes.some(
      (episode) => String(episode.episode_number) === String(modalEpisode)
    );
    if (!episodeValid) {
      setModalEpisode(String(modalEpisodes[0].episode_number));
    }
  }, [modal.open, modal.type, modalEpisodes, modalEpisode]);

  useEffect(() => {
    if (!selected) return;
    fetchJson(`/api/tmdb/related?type=${selected.type}&id=${selected.id}`)
      .then((data) => {
        const items = (data.results || []).slice(0, 10).map((item) => ({
          id: String(item.id),
          type: selected.type,
          meta: item,
        }));
        setRelatedItems(items);
        setMetaMap((prev) => {
          const next = { ...prev };
          items.forEach((item) => {
            next[`${item.type}-${item.id}`] = item.meta;
          });
          return next;
        });
      })
      .catch((error) => {
        console.error(error);
        setRelatedItems([]);
      });
  }, [selected]);

  useEffect(() => {
    if (!selected) { setCastData([]); return; }
    fetchJson(`/api/tmdb/credits?type=${selected.type}&id=${selected.id}`)
      .then((data) => setCastData((data.cast || []).slice(0, 20)))
      .catch(() => setCastData([]));
  }, [selected]);

  useEffect(() => {
    if (!selectedPerson) { setPersonData(null); return; }
    let cancelled = false;
    Promise.all([
      fetchJson(`/api/tmdb/person?id=${selectedPerson.id}`),
      fetchJson(`/api/tmdb/person/credits?id=${selectedPerson.id}`),
    ]).then(([details, credits]) => {
      if (cancelled) return;
      const seen = new Map();
      [...(credits.cast || []), ...(credits.crew || []).filter((c) => c.job === "Director")]
        .forEach((item) => { if (!seen.has(item.id)) seen.set(item.id, item); });
      const works = [...seen.values()]
        .filter((item) => item.poster_path)
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
        .slice(0, 24)
        .map((item) => ({
          id: String(item.id),
          type: item.media_type === "movie" ? "movie" : (item.genre_ids || []).includes(ANIMATION_GENRE_ID) ? "anime" : "serie",
          meta: item,
        }));
      setPersonData({ details, works });
    }).catch(() => { if (!cancelled) setPersonData(null); });
    return () => { cancelled = true; };
  }, [selectedPerson]);

  useEffect(() => {
    const handlePop = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (
        parts.length === 2 &&
        (parts[0] === "filme" || parts[0] === "serie" || parts[0] === "anime" || parts[0] === "dorama")
      ) {
        const id = parts[1];
        const type = ROUTE_TO_TYPE[parts[0]] || "movie";
        const item = { id, type };
        setSelected(item);
        ensureMeta(item);
      } else {
        setSelected(null);
      }
    };
    handlePop();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const playerUrl = useMemo(
    () =>
      buildPlayerUrl({
        id: modal.id,
        type: modal.type,
        season: modalSeason,
        episode: modalEpisode,
        provider: playerProvider,
      }),
    [modal, modalSeason, modalEpisode, playerProvider]
  );

  const rowsLabel = useMemo(() => {
    if (tmdbConfigured === false) {
      return "Chave TMDB ausente — abra Configurações";
    }
    if (searching) return "Buscando na API...";
    if (loadingCatalog) return "Carregando catálogo...";
    if (ROUTE_TYPE === "dorama" && doramaLoading && doramaPage === 1) return "Carregando doramas...";
    if (searchResults) return "Resultados da busca";
    if (genreResults) return "Filtro por gênero";
    return status;
  }, [searching, searchResults, loadingCatalog, genreResults, status, tmdbConfigured, doramaLoading, doramaPage]);

  const handleMore = (key) => {
    if (key === "dorama") {
      setDoramaPage((prev) => prev + 1);
    } else {
      setDisplayCounts((prev) => ({
        ...prev,
        [key]: (prev[key] || 10) + 10,
      }));
    }
  };

  if (modal.open) {
    return renderModal();
  }

  if (selectedPerson) {
    return (
      <>
        <PersonDetail
          person={selectedPerson}
          data={personData}
          hasParentDetail={Boolean(selected)}
          onBack={closePerson}
          onSelectWork={openWorkFromPerson}
        />
        {renderModal()}
      </>
    );
  }

  if (selected) {
    const title = selectedMeta?.title || selectedMeta?.name || selected.id;
    const subtitle =
      selectedMeta?.original_title ||
      selectedMeta?.original_name ||
      "Título original não informado";
    const year = pickYear(selectedMeta);
    const rating = selectedMeta?.vote_average?.toFixed?.(1) || "—";
    const runtime =
      selectedMeta?.runtime ||
      selectedMeta?.episode_run_time?.[0] ||
      null;
    const backdropPath = selectedMeta?.backdrop_path
      ? `${BACKDROP_BASE}${selectedMeta.backdrop_path}`
      : "";
    const posterPath = selectedMeta?.poster_path
      ? `${IMAGE_BASE}${selectedMeta.poster_path}`
      : "";

    return (
      <>
        <main>
          <article className="detail">
            <div
              className="detail__backdrop"
              style={backdropPath ? { backgroundImage: `url(${backdropPath})` } : undefined}
              aria-hidden="true"
            />
            <div className="detail__content">
              <button type="button" className="detail__back" onClick={closeDetail}>
                ← Voltar ao catálogo
              </button>

              <div className="detail__layout">
                <div
                  className="detail__poster"
                  style={posterPath ? { backgroundImage: `url(${posterPath})` } : undefined}
                >
                  {!posterPath ? <span className="card__placeholder">Sem capa</span> : null}
                </div>

                <div className="detail__info">
                  <p className="detail__eyebrow">
                    {typeLabel(selected.type)}
                    {year ? ` · ${year}` : ""}
                  </p>
                  <h1 className="detail__title">{title}</h1>
                  <p className="detail__subtitle">{subtitle}</p>

                  <div className="detail__meta">
                    <span>
                      Nota <strong>{rating}</strong>
                    </span>
                    {runtime ? (
                      <span>
                        Duração <strong>{runtime} min</strong>
                      </span>
                    ) : null}
                    {selectedMeta?.number_of_seasons ? (
                      <span>
                        Temporadas <strong>{selectedMeta.number_of_seasons}</strong>
                      </span>
                    ) : null}
                  </div>

                  {(selectedMeta?.genres || []).length ? (
                    <div className="detail__genres">
                      {selectedMeta.genres.map((genre) => (
                        <span key={genre.id}>{genre.name}</span>
                      ))}
                    </div>
                  ) : null}

                  <p className="detail__overview">
                    {selectedMeta?.overview || "Sinopse não informada."}
                  </p>

                  <div className="detail__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => openModal(selected)}
                    >
                      Assistir
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={closeDetail}
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </div>

              {castData.length > 0 ? (
                <section className="detail__section">
                  <div className="detail__section-heading">
                    <h2 className="detail__section-title">Elenco</h2>
                  </div>
                  <div className="cast-scroll">
                    {castData.map((member) => (
                      <CastCard
                        key={member.id}
                        member={member}
                        onClick={() => setSelectedPerson({
                          id: String(member.id),
                          name: member.name,
                          character: member.character,
                          profile_path: member.profile_path,
                        })}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {selected.type !== "movie" ? (
                <section className="detail__section">
                  <div className="detail__section-heading">
                    <h2 className="detail__section-title">Temporadas</h2>
                    {seasonList.length > 1 || hasMultipleSeasons(selectedMeta) ? (
                      <select
                        className="detail__season-select"
                        value={seasonNumber}
                        onChange={(event) => setSeasonNumber(event.target.value)}
                        aria-label="Selecionar temporada"
                        disabled={!seasonList.length}
                      >
                        {!seasonList.length ? (
                          <option value={seasonNumber}>Carregando…</option>
                        ) : null}
                        {seasonList.map((season) => (
                          <option
                            key={season.season_number}
                            value={season.season_number}
                          >
                            {season.name || `Temporada ${season.season_number}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="detail__season-label">
                        Temporada {seasonList[0]?.season_number || 1}
                      </span>
                    )}
                  </div>

                  <ol className="episodes">
                    {(seasonData?.episodes || []).map((episode) => (
                      <li key={episode.id}>
                        <button
                          type="button"
                          className="episode"
                          onClick={() =>
                            openModal(
                              { id: selected.id, type: selected.type },
                              String(episode.season_number || seasonNumber),
                              String(episode.episode_number)
                            )
                          }
                        >
                          <div
                            className="episode__image"
                            style={
                              episode.still_path
                                ? { backgroundImage: `url(${STILL_BASE}${episode.still_path})` }
                                : undefined
                            }
                          >
                            {!episode.still_path ? (
                              <span className="card__placeholder">Sem still</span>
                            ) : null}
                            {episode.runtime ? (
                              <span className="episode__runtime">{episode.runtime} min</span>
                            ) : null}
                          </div>
                          <div className="episode__body">
                            <span className="episode__number">
                              T{episode.season_number} · E{episode.episode_number}
                            </span>
                            <span className="episode__title">{episode.name}</span>
                            <p className="episode__overview">
                              {episode.overview || "Sem sinopse."}
                            </p>
                          </div>
                          <span className="episode__chevron" aria-hidden="true">
                            →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {relatedItems.length ? (
                <section className="detail__section">
                  <div className="detail__section-heading">
                    <h2 className="detail__section-title">Itens relacionados</h2>
                  </div>
                  <div className="detail__related-grid">
                    {relatedItems.map((item) => (
                      <MediaCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        meta={item.meta || {}}
                        onSelect={openDetail}
                        compact
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </article>
        </main>

        {renderModal()}
      </>
    );
  }

  function renderModal() {
    return (
      <div
        className={`modal ${modal.open ? "is-open" : ""} ${modalChromeVisible ? "modal--chrome-visible" : ""}`}
        aria-hidden={!modal.open}
        onMouseMove={modal.open ? revealModalChrome : undefined}
        onPointerMove={modal.open ? revealModalChrome : undefined}
        onFocusCapture={keepModalChromeVisible}
        onBlurCapture={() => hideModalChromeSoon(1200)}
      >
        <div className="modal__overlay" onClick={closeModal}></div>
        <div className="modal__content" role="dialog" aria-label="Player de mídia">
          <div className="modal__header">
            <div>
              <h3 className="modal__title">
                Player · {typeLabel(modal.type === "movie" ? "movie" : "serie")}
              </h3>
            </div>
            <button type="button" className="modal__close" onClick={closeModal}>
              ← Voltar ao catálogo
            </button>
          </div>
          <div className="modal__controls">
            <div className="control">
              <label htmlFor="modalProvider">Player</label>
              <select
                id="modalProvider"
                value={playerProvider}
                onChange={(event) => setPlayerProvider(event.target.value)}
              >
                <option value="superflix">SuperFlix</option>
                <option value="vidsrc">Vidsrc</option>
              </select>
            </div>
            <div className="control">
              <label htmlFor="modalType">Tipo</label>
              <select
                id="modalType"
                value={modal.type}
                onChange={(event) =>
                  setModal({ ...modal, type: event.target.value })
                }
              >
                <option value="movie">Filme</option>
                <option value="serie">Série/Anime</option>
              </select>
            </div>
            <div className="control">
              <label htmlFor="modalId">ID</label>
              <input
                id="modalId"
                value={modal.id}
                onChange={(event) =>
                  setModal({ ...modal, id: event.target.value })
                }
              />
            </div>
            <div className="control">
              <label htmlFor="modalSeason">Temporada</label>
              {modal.type === "movie" ? (
                <input id="modalSeason" type="number" value="1" disabled readOnly />
              ) : modalSeasonList.length > 1 || hasMultipleSeasons(modalMeta) ? (
                <select
                  id="modalSeason"
                  value={modalSeason}
                  onChange={(event) => {
                    setModalSeason(event.target.value);
                    setModalEpisode("1");
                  }}
                  disabled={!modalSeasonList.length}
                >
                  {!modalSeasonList.length ? (
                    <option value={modalSeason}>Carregando…</option>
                  ) : null}
                  {modalSeasonList.map((season) => (
                    <option
                      key={season.season_number}
                      value={season.season_number}
                    >
                      {season.name || `Temporada ${season.season_number}`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="modalSeason"
                  type="number"
                  min="1"
                  value={modalSeason}
                  onChange={(event) => {
                    setModalSeason(event.target.value);
                    setModalEpisode("1");
                  }}
                />
              )}
            </div>
            <div className="control">
              <label htmlFor="modalEpisode">Episódio</label>
              {modal.type === "movie" ? (
                <input id="modalEpisode" type="number" value="1" disabled readOnly />
              ) : modalEpisodes.length ? (
                <select
                  id="modalEpisode"
                  value={modalEpisode}
                  onChange={(event) => setModalEpisode(event.target.value)}
                >
                  {modalEpisodes.map((episode) => (
                    <option
                      key={episode.id || episode.episode_number}
                      value={episode.episode_number}
                    >
                      E{episode.episode_number}
                      {episode.name ? ` · ${episode.name}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="modalEpisode"
                  type="number"
                  min="1"
                  value={modalEpisode}
                  onChange={(event) => setModalEpisode(event.target.value)}
                  placeholder={modal.open ? "Carregando…" : ""}
                />
              )}
            </div>
            <div className="control control--action">
              <span className="control__spacer" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setModal({ ...modal })}
              >
                Atualizar
              </button>
            </div>
          </div>
          <div className="modal__player">
            <div
              className="modal__motion-catcher"
              aria-hidden="true"
              onMouseMove={revealModalChrome}
              onPointerMove={revealModalChrome}
            />
            {modal.open ? (
              <iframe
                id="playerFrame"
                title="Player de mídia"
                src={playerUrl}
                allowFullScreen
              ></iframe>
            ) : null}
            {modal.open && modal.type !== "movie" ? (
              <div
                className="modal__quick-controls"
                aria-label="Selecao rapida de temporada e episodio"
              >
                <label className="modal__quick-field" title="Temporada">
                  <span>T</span>
                  {modalSeasonList.length > 1 || hasMultipleSeasons(modalMeta) ? (
                    <select
                      value={modalSeason}
                      onChange={(event) => {
                        setModalSeason(event.target.value);
                        setModalEpisode("1");
                      }}
                      disabled={!modalSeasonList.length}
                      aria-label="Selecionar temporada"
                    >
                      {!modalSeasonList.length ? (
                        <option value={modalSeason}>...</option>
                      ) : null}
                      {modalSeasonList.map((season) => (
                        <option
                          key={season.season_number}
                          value={season.season_number}
                        >
                          {season.name || `Temporada ${season.season_number}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={modalSeason}
                      onChange={(event) => {
                        setModalSeason(event.target.value);
                        setModalEpisode("1");
                      }}
                      aria-label="Selecionar temporada"
                    />
                  )}
                </label>
                <label className="modal__quick-field" title="Episodio">
                  <span>E</span>
                  {modalEpisodes.length ? (
                    <select
                      value={modalEpisode}
                      onChange={(event) => setModalEpisode(event.target.value)}
                      aria-label="Selecionar episodio"
                    >
                      {modalEpisodes.map((episode) => (
                        <option
                          key={episode.id || episode.episode_number}
                          value={episode.episode_number}
                        >
                          E{episode.episode_number}
                          {episode.name ? ` · ${episode.name}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={modalEpisode}
                      onChange={(event) => setModalEpisode(event.target.value)}
                      aria-label="Selecionar episodio"
                    />
                  )}
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CatalogFilters
        search={search}
        onSearchChange={setSearch}
        genreFilter={genreFilter}
        onGenreChange={setGenreFilter}
        genreOptions={genreOptions}
        status={rowsLabel}
        yearFilter={yearFilter}
        onYearChange={setYearFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        networkFilter={networkFilter}
        onNetworkChange={setNetworkFilter}
        panelOpen={filterPanelOpen}
        onTogglePanel={() => setFilterPanelOpen((v) => !v)}
        onClear={() => {
          setSearch("");
          setGenreFilter("all");
          setYearFilter("");
          setStatusFilter("all");
          setNetworkFilter("all");
        }}
      />
      <main>
        <Hero featured={featured} onWatch={openDetail} />

        <section className="rows" id="rows">
          <div className="rows__container">
            {filteredRows.map((row) => (
              <GridRow
                key={row.key}
                title={row.title}
                eyebrow={row.eyebrow}
                status={rowsLabel}
                items={row.items}
                onSelect={openDetail}
                hasMore={row.hasMore}
                onMore={() => handleMore(row.key)}
              />
            ))}
          </div>
        </section>
      </main>

      {renderModal()}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
