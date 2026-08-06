// @ts-nocheck — App state machine; components/lib are typed
// Catalog root — state + detail/modal; presentational pieces live in src/components
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  BACKDROP_BASE,
  IMAGE_BASE,
  NETFLIX_LAYOUT,
  PROFILE_BASE,
  ROUTE_TYPE,
  STILL_BASE,
  categories,
} from "../lib/constants";
import { fetchJson, fetchMetaBatch } from "../lib/api";
import {
  applyDiscoverItems,
  buildDiscoverParams,
  buildPlayerUrl,
  categoriesForTypeFilter,
  emptyCatalog,
  episodesFromSeasonData,
  hasMultipleSeasons,
  isVisibleMedia,
  itemMatchesNetwork,
  itemMatchesStatus,
  itemMatchesYear,
  mediaTypeToRoute,
  needsFullSeriesMeta,
  normalizeList,
  pickYear,
  seasonListFromMeta,
  tmdbAppType,
  typeLabel,
} from "../lib/media";
import {
  Carousel,
  CatalogFilters,
  CastCard,
  GridRow,
  Hero,
  MediaCard,
  PersonDetail,
} from "../components";
import type { MediaItem, MediaMeta, MediaType } from "../types/media";

export function App() {
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
  const [historyItems, setHistoryItems] = useState([]);
  const metaMapRef = useRef({});
  const modalChromeTimerRef = useRef(null);

  const loadHistory = () => {
    try {
      const key = "meuplayer_history";
      const raw = localStorage.getItem(key);
      if (raw) {
        setHistoryItems(JSON.parse(raw));
      } else {
        setHistoryItems([]);
      }
    } catch (e) {
      setHistoryItems([]);
    }
  };

  const savePlaybackProgress = (item, season = "1", episode = "1") => {
    try {
      const key = "meuplayer_history";
      const raw = localStorage.getItem(key);
      let history = raw ? JSON.parse(raw) : [];

      history = history.filter((h) => !(h.id === item.id && h.type === item.type));

      const metaKey = `${item.type}-${item.id}`;
      const meta = metaMapRef.current[metaKey] || {};

      history.unshift({
        id: item.id,
        type: item.type,
        season: season,
        episode: episode,
        timestamp: Date.now(),
        meta: {
          title: meta.title || meta.name || item.id,
          poster_path: meta.poster_path || "",
          backdrop_path: meta.backdrop_path || "",
          overview: meta.overview || ""
        }
      });

      if (history.length > 10) {
        history = history.slice(0, 10);
      }

      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      console.error("Erro ao salvar progresso de reprodução:", e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [modal.open]);

  useEffect(() => {
    if (modal.open && modal.id) {
      savePlaybackProgress({ id: modal.id, type: modal.type }, modalSeason, modalEpisode);
    }
  }, [modal.open, modal.id, modal.type, modalSeason, modalEpisode]);

  useEffect(() => {
    metaMapRef.current = metaMap;
  }, [metaMap]);

  useEffect(() => {
    document.body.classList.toggle("filters-open", filterPanelOpen);
    return () => document.body.classList.remove("filters-open");
  }, [filterPanelOpen]);

  useEffect(() => {
    if (!NETFLIX_LAYOUT) return;
    document.body.classList.add("layout-netflix");
    return () => document.body.classList.remove("layout-netflix");
  }, []);

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
    document.body.classList.toggle("player-open", modal.open);
    return () => document.body.classList.remove("player-open");
  }, [modal.open]);

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
    // No layout Netflix os detalhes abrem como overlay sobre a /netflix,
    // então não reescrevemos o caminho para as páginas dedicadas.
    if (NETFLIX_LAYOUT) return;
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

  if (NETFLIX_LAYOUT) {
    return renderNetflixHome();
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

  function renderDetail() {
    if (!selected) return null;
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
    );
  }

  if (selected) {
    return (
      <>
        <main>{renderDetail()}</main>
        {renderModal()}
      </>
    );
  }

  function renderModal() {
    const backToDetailLabel =
      modal.type === "movie" ? "Voltar aos detalhes do filme" : "Voltar aos detalhes";

    return (
      <div
        className={`modal modal--immersive ${modal.open ? "is-open" : ""} ${modalChromeVisible ? "modal--chrome-visible" : ""}`}
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
              ← Voltar aos detalhes
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
            <button
              type="button"
              className="modal__back-detail"
              onClick={closeModal}
              aria-label={backToDetailLabel}
            >
              ← {backToDetailLabel}
            </button>
            <button
              type="button"
              className="modal__back-detail modal__back-detail--fallback"
              onClick={() => setPlayerProvider((prev) => prev === "superflix" ? "vidsrc" : "superflix")}
            >
              Problema com o vídeo? Alternar Player ({playerProvider === "superflix" ? "Vidsrc" : "SuperFlix"})
            </button>
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

  function renderCatalogFilters() {
    return (
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
    );
  }

  function renderNetflixHome() {
    return (
      <>
        {renderCatalogFilters()}
        <main className="nf">
          <Hero featured={featured} onWatch={openDetail} />

          <div className="nf-rows">
            {historyItems.length > 0 && !searchResults && !genreResults && (
              <Carousel
                title="Continuar Assistindo"
                eyebrow="Seu histórico de reprodução"
                items={historyItems.map((item) => ({
                  ...item,
                  meta: item.meta || {},
                  __resume: { season: item.season, episode: item.episode },
                }))}
                onSelect={(clicked) => {
                  openDetail(clicked);
                  setTimeout(() => {
                    openModal(
                      clicked,
                      clicked.__resume?.season,
                      clicked.__resume?.episode
                    );
                  }, 200);
                }}
              />
            )}

            {filteredRows.map((row) => (
              <Carousel
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
        </main>

        {selectedPerson ? (
          <div className="nf-detail-overlay" role="dialog" aria-modal="true">
            <div className="nf-detail-overlay__scroll">
              <PersonDetail
                person={selectedPerson}
                data={personData}
                hasParentDetail={Boolean(selected)}
                onBack={closePerson}
                onSelectWork={openWorkFromPerson}
              />
            </div>
          </div>
        ) : selected ? (
          <div className="nf-detail-overlay" role="dialog" aria-modal="true">
            <div className="nf-detail-overlay__scroll">{renderDetail()}</div>
          </div>
        ) : null}

        {renderModal()}
      </>
    );
  }

  return (
    <>
      {renderCatalogFilters()}
      <main>
        <Hero featured={featured} onWatch={openDetail} />

        <section className="rows" id="rows">
          <div className="rows__container">
            {historyItems.length > 0 && !searchResults && !genreResults && (
              <section className="row" aria-labelledby="row-history">
                <header className="row__header">
                  <h2 className="row__title" id="row-history">Continuar Assistindo</h2>
                  <span className="row__status">Seu histórico de reprodução</span>
                </header>
                <div className="row__grid">
                  {historyItems.map((item) => (
                    <MediaCard
                      key={`history-${item.type}-${item.id}`}
                      item={item}
                      meta={item.meta || {}}
                      onSelect={(clicked) => {
                        openDetail(clicked);
                        setTimeout(() => {
                          openModal(clicked, item.season, item.episode);
                        }, 200);
                      }}
                      compact
                    />
                  ))}
                </div>
              </section>
            )}

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

