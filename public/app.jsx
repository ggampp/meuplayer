const { useEffect, useMemo, useState } = React;

const API_BASE = "";
const categories = [
  { key: "movie", label: "Filmes" },
  { key: "serie", label: "Séries" },
  { key: "anime", label: "Animes" },
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

function isReleased(meta) {
  if (!meta) return true;
  const dateText = meta.release_date || meta.first_air_date;
  if (!dateText) return true;
  const parsed = Date.parse(dateText);
  if (!parsed) return true;
  return parsed <= Date.now();
}

function GridRow({ title, items, onSelect, hasMore, onMore }) {
  return (
    <div className="row">
      <div className="row__title">{title}</div>
      <div className="row__grid">
        {items.length ? (
          items.map((item) => {
            const meta = item.meta || {};
            const displayTitle =
              meta.title ||
              meta.name ||
              meta.original_title ||
              meta.original_name ||
              item.id;
            const originalTitle =
              meta.original_title || meta.original_name || displayTitle;
            const year =
              (meta.release_date || meta.first_air_date || "").slice(0, 4);
            const posterPath = meta.poster_path
              ? `${IMAGE_BASE}${meta.poster_path}`
              : "";
            return (
              <button
                key={`${item.type}-${item.id}`}
                className="card"
                onClick={() => onSelect(item)}
              >
                <div
                  className="card__poster"
                  style={
                    posterPath
                      ? { backgroundImage: `url(${posterPath})` }
                      : undefined
                  }
                >
                  {!posterPath ? (
                    <span className="card__placeholder">Sem capa</span>
                  ) : null}
                </div>
                <div className="card__body">
                  <span className="card__title">{displayTitle}</span>
                  <span className="card__subtitle">
                    {originalTitle}
                    {year ? ` · ${year}` : ""}
                  </span>
                  <span className="card__action">Assistir agora</span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rows__status">Nenhum item encontrado.</div>
        )}
      </div>
      {hasMore ? (
        <button className="row__more" onClick={onMore}>
          Mais
        </button>
      ) : null}
    </div>
  );
}

function App() {
  const [lists, setLists] = useState({});
  const [status, setStatus] = useState("Carregando...");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ROUTE_TYPE || "all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [genres, setGenres] = useState({ movie: [], tv: [] });
  const [searchResults, setSearchResults] = useState(null);
  const [genreResults, setGenreResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loadingGenre, setLoadingGenre] = useState(false);
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
    setGenreFilter("all");
  }, [typeFilter]);

  useEffect(() => {
    setDisplayCounts({ movie: 10, serie: 10, anime: 10 });
  }, [lists, searchResults]);

  useEffect(() => {
    async function load() {
      try {
        setStatus("Carregando...");
        const categoriesToFetch =
          typeFilter === "all"
            ? categories
            : categories.filter((category) => category.key === typeFilter);
        const results = await Promise.all(
          categoriesToFetch.map((category) =>
            fetchJson(
              `/api/lista?category=${category.key}&type=tmdb&format=json&order=desc`
            ).then(normalizeList)
          )
        );
        const next = {};
        categories.forEach((category) => {
          next[category.key] = [];
        });
        categoriesToFetch.forEach((category, index) => {
          next[category.key] = results[index];
        });
        setLists(next);
        setStatus("Catálogo atualizado");
      } catch (error) {
        console.error(error);
        setStatus("Erro ao carregar catálogo");
      }
    }
    load();
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
    if (genreFilter === "all") {
      setGenreResults(null);
      setLoadingGenre(false);
      return;
    }

    let active = true;
    setLoadingGenre(true);
    const [filterType, filterId] = genreFilter.split(":");
    const apiType = filterType === "movie" ? "movie" : "tv";
    const targetType = apiType === "movie"
      ? "movie"
      : typeFilter === "anime"
        ? "anime"
        : "serie";

    fetchJson(
      `/api/tmdb/discover?type=${apiType}&genre=${encodeURIComponent(filterId)}&page=1`
    )
      .then((data) => {
        if (!active) return;
        const items = (data?.results || []).slice(0, 50).filter(isReleased);
        const nextResults = { movie: [], serie: [], anime: [] };
        const nextMeta = {};
        nextResults[targetType] = items.map((item) => ({
          id: String(item.id),
          type: targetType,
          meta: item,
        }));
        items.forEach((item) => {
          nextMeta[`${targetType}-${item.id}`] = item;
        });
        setMetaMap((prev) => ({ ...prev, ...nextMeta }));
        setGenreResults(nextResults);
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setGenreResults({ movie: [], serie: [], anime: [] });
        }
      })
      .finally(() => {
        if (active) setLoadingGenre(false);
      });

    return () => {
      active = false;
    };
  }, [genreFilter, typeFilter]);

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
          const nextResults = { movie: [], serie: [], anime: [] };
          const nextMeta = {};
          results.forEach((result) => {
            const items = (result.data?.results || []).slice(0, 50).filter(isReleased);
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
  }, [search, typeFilter]);

  useEffect(() => {
    const sourceLists = searchResults || genreResults || lists;
    const items = [];
    categories.forEach((category) => {
      const list = sourceLists[category.key] || [];
      const limit = displayCounts[category.key] || 10;
      list.slice(0, limit).forEach((entry) => {
        const id = typeof entry === "object" ? entry.id : entry;
        if (!id) return;
        const key = `${category.key}-${id}`;
        if (!metaMap[key]) {
          items.push({ id, type: category.key, key });
        }
      });
    });
    if (!items.length) return;

    let cancelled = false;
    Promise.all(
      items.map((item) =>
        fetchJson(`/api/tmdb?type=${item.type}&id=${item.id}`)
          .then((data) => ({ key: item.key, data }))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setMetaMap((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (result && result.data) {
            next[result.key] = result.data;
          }
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [lists, searchResults, genreResults, metaMap, displayCounts]);

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
    const sourceLists = searchResults || genreResults || lists;
    return categories.map((category) => {
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
      if (genreFilter !== "all") {
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
    displayCounts,
  ]);

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
    if (searching) return "Buscando na API...";
    if (searchResults) return "Resultados da pesquisa";
    if (loadingGenre) return "Filtrando por gênero na API...";
    if (genreResults) return "Resultados por gênero";
    return status;
  }, [searching, searchResults, loadingGenre, genreResults, status]);

  const handleMore = (key) => {
    setDisplayCounts((prev) => ({
      ...prev,
      [key]: (prev[key] || 10) + 10,
    }));
  };

  return (
    <>
      <main>
        {selected ? (
          <section className="detail">
            <div
              className="detail__backdrop"
              style={{
                backgroundImage: selectedMeta?.backdrop_path
                  ? `url(${BACKDROP_BASE}${selectedMeta.backdrop_path})`
                  : undefined,
              }}
            ></div>
            <div className="detail__content">
              <button className="detail__back" onClick={closeDetail}>
                ← Voltar ao catálogo
              </button>
              <div className="detail__layout">
                <div
                  className="detail__poster"
                  style={{
                    backgroundImage: selectedMeta?.poster_path
                      ? `url(${IMAGE_BASE}${selectedMeta.poster_path})`
                      : undefined,
                  }}
                >
                  {!selectedMeta?.poster_path ? (
                    <span className="card__placeholder">Sem capa</span>
                  ) : null}
                </div>
                <div className="detail__info">
                  <h1 className="detail__title">
                    {selectedMeta?.title ||
                      selectedMeta?.name ||
                      selected.id}
                  </h1>
                  <p className="detail__subtitle">
                    {selectedMeta?.original_title ||
                      selectedMeta?.original_name ||
                      "Título original não informado"}
                    {(selectedMeta?.release_date ||
                      selectedMeta?.first_air_date) &&
                      ` · ${(
                        selectedMeta.release_date ||
                        selectedMeta.first_air_date
                      ).slice(0, 4)}`}
                  </p>
                  <div className="detail__meta">
                    <span>
                      Nota: {selectedMeta?.vote_average?.toFixed?.(1) || "N/A"}
                    </span>
                    <span>
                      Duração:{" "}
                      {selectedMeta?.runtime ||
                        selectedMeta?.episode_run_time?.[0] ||
                        "N/D"}{" "}
                      min
                    </span>
                  </div>
                  <div className="detail__genres">
                    {(selectedMeta?.genres || []).length
                      ? selectedMeta.genres.map((genre) => (
                          <span key={genre.id}>{genre.name}</span>
                        ))
                      : "Gêneros não informados"}
                  </div>
                  <p className="detail__overview">
                    {selectedMeta?.overview || "Sinopse não informada."}
                  </p>
                  <div className="detail__actions">
                    <button
                      className="btn btn--primary"
                      onClick={() => openModal(selected)}
                    >
                      Assistir
                    </button>
                    <button className="btn btn--ghost" onClick={closeDetail}>
                      Voltar
                    </button>
                  </div>
                </div>
              </div>
              {selected.type !== "movie" ? (
                <div className="detail__episodes">
                  <div className="detail__episodes-header">
                    <h2>Temporadas</h2>
                    {seasonList.length > 1 ? (
                      <select
                        value={seasonNumber}
                        onChange={(event) => setSeasonNumber(event.target.value)}
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
                  <div className="detail__episodes-grid">
                    {(seasonData?.episodes || []).map((episode) => (
                      <button
                        key={episode.id}
                        className="episode-card"
                        onClick={() =>
                          openModal(
                            { id: selected.id, type: selected.type },
                            String(episode.season_number || seasonNumber),
                            String(episode.episode_number)
                          )
                        }
                      >
                        <div
                          className="episode-card__image"
                          style={{
                            backgroundImage: episode.still_path
                              ? `url(${STILL_BASE}${episode.still_path})`
                              : undefined,
                          }}
                        >
                          {!episode.still_path ? (
                            <span className="card__placeholder">Sem imagem</span>
                          ) : null}
                          <span className="episode-card__runtime">
                            {episode.runtime || episode.vote_average
                              ? `${episode.runtime || "?"} min`
                              : ""}
                          </span>
                        </div>
                        <div className="episode-card__body">
                          <strong>
                            T{episode.season_number}:E{episode.episode_number}{" "}
                            {episode.name}
                          </strong>
                          <p>
                            {episode.overview
                              ? episode.overview.slice(0, 140) +
                                (episode.overview.length > 140 ? "..." : "")
                              : "Sem sinopse."}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {relatedItems.length ? (
                <div className="detail__related">
                  <h2>Itens relacionados</h2>
                  <div className="detail__related-grid">
                    {relatedItems.map((item) => {
                      const meta = item.meta || {};
                      const title =
                        meta.title ||
                        meta.name ||
                        meta.original_title ||
                        meta.original_name ||
                        item.id;
                      const posterPath = meta.poster_path
                        ? `${IMAGE_BASE}${meta.poster_path}`
                        : "";
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          className="card"
                          onClick={() => openDetail(item)}
                        >
                          <div
                            className="card__poster"
                            style={
                              posterPath
                                ? { backgroundImage: `url(${posterPath})` }
                                : undefined
                            }
                          >
                            {!posterPath ? (
                              <span className="card__placeholder">
                                Sem capa
                              </span>
                            ) : null}
                          </div>
                          <div className="card__body">
                            <span className="card__title">{title}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
        <>
        <header className="catalog-header">
          <section className="filters">
            <label>
              Tipo
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Todos</option>
                <option value="movie">Filmes</option>
                <option value="serie">Séries</option>
                <option value="anime">Animes</option>
              </select>
            </label>
            <label>
              Busca
              <input
                type="search"
                placeholder="Buscar por nome ou ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
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
            <label>
              Limite por lista
              <input
                type="text"
                value="10 itens (use Mais)"
                readOnly
              />
            </label>
          </section>
        </header>

        <section id="rows" className="rows">
          <div className="rows__header">
            <h2>Catálogo</h2>
            <span className="rows__status">{rowsLabel}</span>
          </div>
          <div className="rows__container">
            {filteredRows.map((row) => (
              <GridRow
                key={row.key}
                title={row.title}
                items={row.items}
                onSelect={openDetail}
                hasMore={row.hasMore}
                onMore={() => handleMore(row.key)}
              />
            ))}
          </div>
        </section>

        </>
        )}
      </main>

      <div className={`modal ${modal.open ? "is-open" : ""}`} aria-hidden={!modal.open}>
        <div className="modal__overlay" onClick={closeModal}></div>
        <div className="modal__content">
          <div className="modal__header">
            <div>
              <h3>Player {modal.type}</h3>
              <p className="modal__meta">
                {playerUrl ? `URL: ${playerUrl}` : "Informe um ID válido."}
              </p>
            </div>
            <button className="modal__close" onClick={closeModal}>
              &times;
            </button>
          </div>
          <div className="modal__controls">
            <div className="control">
              <label>Player</label>
              <select
                value={playerProvider}
                onChange={(event) => setPlayerProvider(event.target.value)}
              >
                <option value="superflix">SuperFlix</option>
                <option value="vidsrc">Vidsrc</option>
              </select>
            </div>
            <div className="control">
              <label>Tipo</label>
              <select
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
              <label>ID</label>
              <input
                value={modal.id}
                onChange={(event) =>
                  setModal({ ...modal, id: event.target.value })
                }
              />
            </div>
            <div className="control">
              <label>Temporada</label>
              <input
                type="number"
                min="1"
                value={modalSeason}
                onChange={(event) => setModalSeason(event.target.value)}
                disabled={modal.type === "movie"}
              />
            </div>
            <div className="control">
              <label>Episódio</label>
              <input
                type="number"
                min="1"
                value={modalEpisode}
                onChange={(event) => setModalEpisode(event.target.value)}
                disabled={modal.type === "movie"}
              />
            </div>
            <button className="btn btn--primary" onClick={() => setModal({ ...modal })}>
              Atualizar
            </button>
          </div>
          <div className="modal__player">
            {modal.open ? (
              <iframe
                id="playerFrame"
                title="SuperFlix Player"
                src={playerUrl}
                allowFullScreen
              ></iframe>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
