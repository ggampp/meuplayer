// @ts-nocheck — App state machine; components/lib are typed
// Catalog root — state + detail/modal; presentational pieces live in src/components
import { useEffect, useMemo, useState, useRef } from "react";
import { ANIMATION_GENRE_ID, ROUTE_TO_TYPE, NETFLIX_LAYOUT, ROUTE_TYPE, categories } from "../lib/constants";
import { fetchJson, fetchMetaBatch } from "../lib/api";
import { buildPlayerUrl, categoriesForTypeFilter, emptyCatalog, episodesFromSeasonData, isVisibleMedia, itemMatchesNetwork, itemMatchesStatus, itemMatchesYear, mediaTypeToRoute, needsFullSeriesMeta, normalizeList, seasonListFromMeta } from "../lib/media";
import { Carousel, CatalogFilters, GridRow, Hero, MediaCard, PersonDetail } from "../components";


import { usePlaybackHistory } from "../hooks/usePlaybackHistory";
import { useVodSearch } from "../hooks/useVodSearch";
import { matchesSearch } from "../../../shared/lib/search";
import { sortVodItems } from "../lib/search";

import { VodDetail } from "../components/VodDetail";
import { VodPlayer } from "../components/VodPlayer";

export function App() {
  const initialQuery = new URLSearchParams(window.location.search);
  const [typeFilter, setTypeFilter] = useState(ROUTE_TYPE || (["movie", "serie", "anime", "dorama"].includes(initialQuery.get("type")) ? initialQuery.get("type") : "all"));
  const [lists, setLists] = useState({});
  const [status, setStatus] = useState("Carregando...");
  const [search, setSearch] = useState(initialQuery.get("q") || "");
  const [genreFilter, setGenreFilter] = useState(initialQuery.get("genre") || "all");
  const [yearFilter, setYearFilter] = useState(initialQuery.get("year") || "");
  const [statusFilter, setStatusFilter] = useState(initialQuery.get("status") || "all");
  const [networkFilter, setNetworkFilter] = useState(initialQuery.get("network") || "all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [genres, setGenres] = useState({ movie: [], tv: [] });
  const [ratingFilter, setRatingFilter] = useState(initialQuery.get("rating") || "");
  const [sortOrder, setSortOrder] = useState(initialQuery.get("sort") || "relevance");
  const advancedSearch = useVodSearch({ search, type: typeFilter, genre: genreFilter, year: yearFilter, rating: ratingFilter, sort: sortOrder, status: statusFilter, network: networkFilter });
  const searchResults = advancedSearch.results;
  const searching = advancedSearch.busy;
  useEffect(() => {
    const url = new URL(window.location.href);
    const values = { q: search, genre: genreFilter, year: yearFilter, status: statusFilter, network: networkFilter, rating: ratingFilter, sort: sortOrder, type: typeFilter };
    Object.entries(values).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "relevance") url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    window.history.replaceState(null, "", url);
  }, [search, genreFilter, yearFilter, statusFilter, networkFilter, ratingFilter, sortOrder, typeFilter]);
  const [genreResults, setGenreResults] = useState(null);

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

  const historyItems = usePlaybackHistory(modal, modalSeason, modalEpisode, metaMapRef);

  useEffect(() => {
    metaMapRef.current = metaMap;
  }, [metaMap]);


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
    setDisplayCounts({ movie: 10, serie: 10, anime: 10 });
  }, [typeFilter, genreFilter, search, yearFilter, ratingFilter, sortOrder, statusFilter, networkFilter, advancedSearch.page]);

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
    if (typeFilter !== "dorama") return;
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
  }, [doramaPage, typeFilter]);

  useEffect(() => {
    if (searchResults) { setLoadingCatalog(false); return; }
    if (typeFilter === "dorama") return;

    let active = true;

    async function loadCatalog() {
      setLoadingCatalog(true);
      setStatus("Carregando...");
      setGenreResults(null);

      try {
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
  }, [typeFilter, genreFilter, search, yearFilter, ratingFilter, sortOrder, statusFilter, networkFilter]);

  useEffect(() => {
    const sourceLists = searchResults || genreResults || lists;
    const pendingByType = {};
    const currentMeta = metaMapRef.current;

    categories.forEach((category) => {
      const list = sourceLists[category.key] || [];
      const limit = searchResults ? list.length : displayCounts[category.key] || 10;
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
      (typeFilter === "dorama" ? { ...emptyCatalog(), dorama: doramaItems } : lists);
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
            return { ...entry, meta: { ...entry.meta, ...metaMap[`${entry.type}-${entry.id}`] } };
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
            matchesSearch(`${title} ${original} ${item.id}`, normalized)
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
      if (ratingFilter) items = items.filter(item => Number(item.meta?.vote_average || 0) >= Number(ratingFilter));
      items = sortVodItems(items, sortOrder);
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
    ratingFilter,
    sortOrder,
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
        : "/vod";
    if (replace) {
      window.history.replaceState({}, "", path + window.location.search);
    } else {
      window.history.pushState({}, "", path + window.location.search);
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
    if (advancedSearch.error) return advancedSearch.error;
    if (searching) return "Pesquisando títulos…";
    if (loadingCatalog) return "Carregando catálogo...";
    if (ROUTE_TYPE === "dorama" && doramaLoading && doramaPage === 1) return "Carregando doramas...";
    if (searchResults) return "Resultados da busca";
    if (genreResults) return "Filtro por gênero";
    return status;
  }, [advancedSearch.error, searching, searchResults, loadingCatalog, genreResults, status, tmdbConfigured, doramaLoading, doramaPage]);

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

  function renderDetail() { return <VodDetail genres={genres} selected={selected} seasonNumber={seasonNumber} setSeasonNumber={setSeasonNumber} seasonData={seasonData} relatedItems={relatedItems} castData={castData} setSelectedPerson={setSelectedPerson} selectedMeta={selectedMeta} seasonList={seasonList} openModal={openModal} openDetail={openDetail} closeDetail={closeDetail} />; }

  if (selected) {
    return (
      <>
        <main>{renderDetail()}</main>
        {renderModal()}
      </>
    );
  }

  function renderModal() { return <VodPlayer modal={modal} setModal={setModal} modalSeason={modalSeason} setModalSeason={setModalSeason} modalEpisode={modalEpisode} setModalEpisode={setModalEpisode} modalChromeVisible={modalChromeVisible} playerProvider={playerProvider} setPlayerProvider={setPlayerProvider} hideModalChromeSoon={hideModalChromeSoon} revealModalChrome={revealModalChrome} keepModalChromeVisible={keepModalChromeVisible} modalMeta={modalMeta} modalSeasonList={modalSeasonList} modalEpisodes={modalEpisodes} closeModal={closeModal} playerUrl={playerUrl} />; }

  function renderCatalogFilters() {
    return (
      <CatalogFilters
        search={search}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        typeLocked={!!ROUTE_TYPE}
        ratingFilter={ratingFilter}
        onRatingChange={setRatingFilter}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        page={advancedSearch.page}
        pages={advancedSearch.pages}
        onPageChange={advancedSearch.setPage}
        searching={searching}
        error={advancedSearch.error}
        remoteResults={!!searchResults}
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
          setRatingFilter("");
          setSortOrder("relevance");
          setTypeFilter(ROUTE_TYPE || "all");
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
