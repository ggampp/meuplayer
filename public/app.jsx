const { useEffect, useMemo, useState } = React;

const API_BASE = "";
const categories = [
  { key: "movie", label: "Filmes", eyebrow: "Cinema" },
  { key: "serie", label: "Séries", eyebrow: "Live action" },
  { key: "anime", label: "Animes", eyebrow: "Animação" },
];

const LANGUAGE_OPTIONS = [
  { value: "all", label: "Todos os idiomas" },
  { value: "pt", label: "Português" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
  { value: "ko", label: "Coreano" },
  { value: "ja", label: "Japonês" },
  { value: "zh", label: "Chinês" },
  { value: "fr", label: "Francês" },
  { value: "de", label: "Alemão" },
  { value: "it", label: "Italiano" },
  { value: "hi", label: "Hindi" },
  { value: "th", label: "Tailandês" },
  { value: "vi", label: "Vietnamita" },
  { value: "id", label: "Indonésio" },
  { value: "tr", label: "Turco" },
  { value: "ru", label: "Russo" },
  { value: "ar", label: "Árabe" },
];
const IMAGE_BASE = "/api/image/tmdb/w500";
const BACKDROP_BASE = "/api/image/tmdb/w1280";
const STILL_BASE = "/api/image/tmdb/w780";
const ROUTE_TO_TYPE = {
  filme: "movie",
  serie: "serie",
  anime: "anime",
};

function getRouteTypeFromPath(pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  return ROUTE_TO_TYPE[firstSegment] || null;
}

const ROUTE_TYPE = window.MEUPLAYER_ROUTE || getRouteTypeFromPath(window.location.pathname);

function mediaTypeToRoute(type) {
  if (type === "movie") return "filme";
  if (type === "anime") return "anime";
  return "serie";
}

function tmdbAppType(type) {
  if (type === "movie") return "movie";
  return "serie";
}

async function fetchMetaBatch(type, ids) {
  if (!ids.length) return {};
  const unique = [...new Set(ids.map(String))].slice(0, 80);
  const query = new URLSearchParams({
    type: tmdbAppType(type),
    ids: unique.join(","),
  });
  const data = await fetchJson(`/api/media/meta/batch?${query.toString()}`);
  return data.items || {};
}

function fetchJson(path) {
  return fetch(`${API_BASE}${path}`).then((res) => {
    if (!res.ok) {
      throw new Error("Falha na API");
    }
    return res.json();
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

function matchesOriginalLanguage(meta, languageFilter) {
  if (!languageFilter || languageFilter === "all") return true;
  if (!meta) return false;
  const lang = (meta.original_language || "").toLowerCase();
  if (lang === languageFilter) return true;
  if (languageFilter === "zh" && (lang === "cn" || lang === "tw")) return true;
  return false;
}

function isAnimationTv(meta) {
  if (!meta) return false;
  const genreIds = [...(meta.genre_ids || [])];
  (meta.genres || []).forEach((genre) => {
    genreIds.push(genre.id ?? genre);
  });
  return genreIds.includes(ANIMATION_GENRE_ID);
}

function emptyCatalog() {
  return { movie: [], serie: [], anime: [] };
}

function categoriesForTypeFilter(typeFilter) {
  if (typeFilter === "all") return categories;
  return categories.filter((category) => category.key === typeFilter);
}

function buildDiscoverParams(apiType, { genreId, language, page = "1" } = {}) {
  const params = new URLSearchParams({ type: apiType, page });
  if (genreId) params.set("genre", genreId);
  if (language && language !== "all") {
    params.set("original_language", language);
  }
  return params;
}

function applyDiscoverItems(nextResults, nextMeta, items, options = {}) {
  const { onlyType, tvAs } = options;
  items.filter(isReleased).forEach((item) => {
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

function pickYear(meta) {
  return (meta?.release_date || meta?.first_air_date || "").slice(0, 4);
}

function typeLabel(type) {
  if (type === "movie") return "Filme";
  if (type === "anime") return "Anime";
  return "Série";
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

function Hero({ featured, status, onWatch }) {
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
        <p className="hero__meta">{status || "Carregando catálogo..."}</p>
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
        <span className="hero__meta">{status}</span>
      </div>
    </section>
  );
}

function App() {
  const [lists, setLists] = useState({});
  const [status, setStatus] = useState("Carregando...");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ROUTE_TYPE || "all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [genres, setGenres] = useState({ movie: [], tv: [] });
  const [searchResults, setSearchResults] = useState(null);
  const [genreResults, setGenreResults] = useState(null);
  const [languageResults, setLanguageResults] = useState(null);
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
  const [playerProvider, setPlayerProvider] = useState("superflix");
  const [metaMap, setMetaMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [seasonData, setSeasonData] = useState(null);
  const [relatedItems, setRelatedItems] = useState([]);

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
  }, [typeFilter, genreFilter, languageFilter]);

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
    if (search.trim().length >= 2) return;

    let active = true;

    async function loadCatalog() {
      setLoadingCatalog(true);
      setStatus("Carregando...");
      setGenreResults(null);
      setLanguageResults(null);

      try {
        if (genreFilter !== "all") {
          const [filterType, filterId] = genreFilter.split(":");
          const apiType = filterType === "movie" ? "movie" : "tv";
          const discoverParams = buildDiscoverParams(apiType, {
            genreId: filterId,
            language: languageFilter,
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

        if (languageFilter !== "all") {
          const nextResults = emptyCatalog();
          const nextMeta = {};
          const requests = [];

          if (typeFilter === "all" || typeFilter === "movie") {
            requests.push(
              fetchJson(
                `/api/tmdb/discover?${buildDiscoverParams("movie", {
                  language: languageFilter,
                }).toString()}`
              ).then((data) => ({ scope: "movie", data }))
            );
          }
          if (typeFilter === "all" || typeFilter === "serie" || typeFilter === "anime") {
            requests.push(
              fetchJson(
                `/api/tmdb/discover?${buildDiscoverParams("tv", {
                  language: languageFilter,
                }).toString()}`
              ).then((data) => ({ scope: "tv", data }))
            );
          }

          const responses = await Promise.all(requests);
          if (!active) return;

          responses.forEach(({ scope, data }) => {
            const options = { tvAs: scope === "tv" };
            if (typeFilter === "anime") options.onlyType = "anime";
            else if (typeFilter === "serie") options.onlyType = "serie";
            else if (typeFilter === "movie") options.onlyType = "movie";
            applyDiscoverItems(
              nextResults,
              nextMeta,
              (data?.results || []).slice(0, 50),
              options
            );
          });

          setMetaMap((prev) => ({ ...prev, ...nextMeta }));
          setLanguageResults(nextResults);
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
  }, [typeFilter, genreFilter, languageFilter, search]);

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
      } else if (typeFilter === "serie" || typeFilter === "anime") {
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
            let items = (result.data?.results || []).slice(0, 50).filter(isReleased);
            if (languageFilter !== "all") {
              items = items.filter((item) =>
                matchesOriginalLanguage(item, languageFilter)
              );
            }
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
              const targetType = typeFilter === "anime" ? "anime" : "serie";
              nextResults[targetType] = items.map((item) => ({
                id: String(item.id),
                type: targetType,
                meta: item,
              }));
              items.forEach((item) => {
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
  }, [search, typeFilter, languageFilter]);

  useEffect(() => {
    const sourceLists =
      searchResults || genreResults || languageResults || lists;
    const pendingByType = {};
    categories.forEach((category) => {
      const list = sourceLists[category.key] || [];
      const limit = displayCounts[category.key] || 10;
      list.slice(0, limit).forEach((entry) => {
        const id = typeof entry === "object" ? entry.id : entry;
        if (!id) return;
        const itemType = typeof entry === "object" ? entry.type || category.key : category.key;
        const key = `${itemType}-${id}`;
        if (metaMap[key]) return;
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
    Promise.all(requests).then((results) => {
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
    });

    return () => {
      cancelled = true;
    };
  }, [lists, searchResults, genreResults, languageResults, metaMap, displayCounts]);

  const selectedMeta = useMemo(() => {
    if (!selected) return null;
    return metaMap[`${selected.type}-${selected.id}`] || null;
  }, [selected, metaMap]);

  const seasonList = useMemo(() => {
    if (!selectedMeta?.seasons) return [];
    return selectedMeta.seasons
      .filter((season) => season.season_number !== 0)
      .sort((a, b) => a.season_number - b.season_number);
  }, [selectedMeta]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const sourceLists =
      searchResults || genreResults || languageResults || lists;
    const apiCatalog = Boolean(genreResults || languageResults);
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
      items = items.filter((item) => isReleased(item.meta));
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
      if (genreFilter !== "all" && !apiCatalog) {
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
      items = [...items].sort((a, b) => {
        const aDate = a.meta?.release_date || a.meta?.first_air_date || "";
        const bDate = b.meta?.release_date || b.meta?.first_air_date || "";
        return (Date.parse(bDate) || 0) - (Date.parse(aDate) || 0);
      });
      const total = items.length;
      items = items.slice(0, limit);
      return {
        key: category.key,
        title: category.label,
        eyebrow: category.eyebrow,
        items,
        hasMore: total > limit,
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
    languageResults,
    displayCounts,
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
    if (typeFilter === "serie" || typeFilter === "anime") {
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
  };

  const ensureMeta = async (item) => {
    const key = `${item.type}-${item.id}`;
    if (metaMap[key]) return metaMap[key];
    try {
      const data = await fetchJson(`/api/tmdb?type=${item.type}&id=${item.id}`);
      setMetaMap((prev) => ({ ...prev, [key]: data }));
      return data;
    } catch (error) {
      console.error(error);
      return null;
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
    const handlePop = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (
        parts.length === 2 &&
        (parts[0] === "filme" || parts[0] === "serie" || parts[0] === "anime")
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
    const langLabel =
      languageFilter !== "all"
        ? LANGUAGE_OPTIONS.find((opt) => opt.value === languageFilter)?.label
        : null;
    if (searching) return "Buscando na API...";
    if (loadingCatalog) return "Carregando catálogo...";
    if (searchResults) {
      return langLabel
        ? `Resultados da busca · ${langLabel}`
        : "Resultados da busca";
    }
    if (genreResults) {
      return langLabel
        ? `Filtro por gênero · ${langLabel}`
        : "Filtro por gênero";
    }
    if (languageResults) {
      return langLabel ? `Filtro por idioma · ${langLabel}` : "Filtro por idioma";
    }
    return status;
  }, [
    searching,
    searchResults,
    loadingCatalog,
    genreResults,
    languageResults,
    status,
    languageFilter,
  ]);

  const handleMore = (key) => {
    setDisplayCounts((prev) => ({
      ...prev,
      [key]: (prev[key] || 10) + 10,
    }));
  };

  const browseEyebrow = useMemo(() => {
    if (ROUTE_TYPE === "movie") return "Catálogo · Filmes";
    if (ROUTE_TYPE === "serie") return "Catálogo · Séries";
    if (ROUTE_TYPE === "anime") return "Catálogo · Animes";
    return "Catálogo · Tudo";
  }, []);

  const browseTitle = useMemo(() => {
    if (ROUTE_TYPE === "movie") return "Filmes";
    if (ROUTE_TYPE === "serie") return "Séries";
    if (ROUTE_TYPE === "anime") return "Animes";
    return "Tudo o que está no MeuPlayer";
  }, []);

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

              {selected.type !== "movie" ? (
                <section className="detail__section">
                  <div className="detail__section-heading">
                    <h2 className="detail__section-title">Temporadas</h2>
                    {seasonList.length > 1 ? (
                      <select
                        className="detail__season-select"
                        value={seasonNumber}
                        onChange={(event) => setSeasonNumber(event.target.value)}
                        aria-label="Selecionar temporada"
                      >
                        {seasonList.map((season) => (
                          <option
                            key={season.season_number}
                            value={season.season_number}
                          >
                            Temporada {season.season_number}
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
        className={`modal ${modal.open ? "is-open" : ""}`}
        aria-hidden={!modal.open}
      >
        <div className="modal__overlay" onClick={closeModal}></div>
        <div className="modal__content" role="dialog" aria-label="Player de mídia">
          <div className="modal__header">
            <div>
              <h3 className="modal__title">
                Player · {typeLabel(modal.type === "movie" ? "movie" : "serie")}
              </h3>
              <p className="modal__meta">
                {playerUrl ? playerUrl : "Informe um ID válido."}
              </p>
            </div>
            <button type="button" className="modal__close" onClick={closeModal}>
              ×
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
              <input
                id="modalSeason"
                type="number"
                min="1"
                value={modalSeason}
                onChange={(event) => setModalSeason(event.target.value)}
                disabled={modal.type === "movie"}
              />
            </div>
            <div className="control">
              <label htmlFor="modalEpisode">Episódio</label>
              <input
                id="modalEpisode"
                type="number"
                min="1"
                value={modalEpisode}
                onChange={(event) => setModalEpisode(event.target.value)}
                disabled={modal.type === "movie"}
              />
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setModal({ ...modal })}
            >
              Atualizar
            </button>
          </div>
          <div className="modal__player">
            {modal.open ? (
              <iframe
                id="playerFrame"
                title="Player de mídia"
                src={playerUrl}
                allowFullScreen
              ></iframe>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <main>
        <Hero featured={featured} status={rowsLabel} onWatch={openDetail} />

        <section className="catalog-header" aria-label="Filtros do catálogo">
          <header className="catalog-header__heading">
            <p className="catalog-header__eyebrow">{browseEyebrow}</p>
            <h2 className="catalog-header__title">{browseTitle}</h2>
          </header>
          <div className="filters">
            <label className="filters__field">
              Tipo
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                disabled={Boolean(ROUTE_TYPE)}
              >
                <option value="all">Todos</option>
                <option value="movie">Filmes</option>
                <option value="serie">Séries</option>
                <option value="anime">Animes</option>
              </select>
            </label>
            <label className="filters__field">
              Busca
              <input
                type="search"
                placeholder="Título, ID, original"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="filters__field">
              Gênero
              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {genreOptions.map((genre) => (
                  <option key={genre.value} value={genre.value}>
                    {genre.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="filters__field">
              Idioma original
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

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
