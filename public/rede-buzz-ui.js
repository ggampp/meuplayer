(function (global) {
  const IFRAME_ALLOW =
    "autoplay *; encrypted-media *; picture-in-picture *; fullscreen *; clipboard-write *; accelerometer *; gyroscope *";

  const ADULT_CATEGORY = "adulto";

  function isAdultCategory(value) {
    return String(value || "").trim().toLowerCase() === ADULT_CATEGORY;
  }

  function isAdultChannel(item) {
    if (!item || typeof item !== "object") return false;
    return (
      isAdultCategory(item.category) ||
      isAdultCategory(item.category_id) ||
      isAdultCategory(item.categoryId)
    );
  }

  function buildEmbedUrl(channel) {
    if (channel.src) return channel.src;
    if (channel.id) return `https://rde.buzz/${channel.id}`;
    return "";
  }

  function normalizeChannel(item) {
    if (isAdultChannel(item)) return null;
    if (item.is_active === false) return null;
    const id = String(item.id || "").trim();
    const nome = item.name || item.nome || id || "Canal";
    let src = item.embed_url || item.src || "";
    if (!src && id) {
      src = `https://rde.buzz/${id}`;
    }
    return {
      id,
      nome,
      src,
      category: item.category || "",
    };
  }

  function extractChannels(payload) {
    if (!payload || payload.success === false) return [];
    const data = payload.data;
    if (Array.isArray(data)) {
      return data.map(normalizeChannel).filter(Boolean);
    }
    if (data && Array.isArray(data.channels)) {
      return data.channels.map(normalizeChannel).filter(Boolean);
    }
    if (data && data.id && (data.embed_url || data.name)) {
      const channel = normalizeChannel(data);
      return channel ? [channel] : [];
    }
    return [];
  }

  function init(config) {
    const store = global.MeuPlayerRedeBuzzStore;
    const mode = config.mode === "favorites" ? "favorites" : "all";

    const grid = document.getElementById("channelsGrid");
    const player = document.getElementById("player");
    const overlay = document.getElementById("playerOverlay");
    const channelUp = document.getElementById("channelUp");
    const channelDown = document.getElementById("channelDown");
    const status = document.getElementById("channelsStatus");
    const searchInput = document.getElementById("channelSearch");
    const categorySelect = document.getElementById("channelCategory");
    const filtersEl = document.querySelector(".workbench__filters");
    const favToggleBtn = document.getElementById("toggleFavoriteBtn");

    if (categorySelect) {
      const categoryField = categorySelect.closest("label");
      if (categoryField) {
        categoryField.hidden = mode !== "all";
      }
    }

    let channelList = [];
    let channelRows = [];
    let activeIndex = -1;
    let overlayTimer = null;
    let searchTimer = null;

    function updateFavoriteButton() {
      if (!favToggleBtn) return;
      const channel = channelList[activeIndex];
      if (!channel) {
        favToggleBtn.hidden = true;
        return;
      }
      favToggleBtn.hidden = false;
      const isFav = store.has(channel.id);
      favToggleBtn.setAttribute("aria-pressed", isFav ? "true" : "false");
      favToggleBtn.title = isFav
        ? "Remover dos favoritos"
        : "Adicionar aos favoritos";
      favToggleBtn.textContent = isFav ? "★" : "☆";
    }

    function refreshFavoriteMarks() {
      channelRows.forEach(({ favBtn, channel }) => {
        if (!favBtn) return;
        const isFav = store.has(channel.id);
        favBtn.setAttribute("aria-pressed", isFav ? "true" : "false");
        favBtn.setAttribute(
          "aria-label",
          isFav ? `Remover ${channel.nome} dos favoritos` : `Favoritar ${channel.nome}`
        );
        favBtn.textContent = isFav ? "★" : "☆";
      });
      updateFavoriteButton();
    }

    function selectChannel(index) {
      const channel = channelList[index];
      const row = channelRows[index];
      if (!channel || !row) return;

      channelRows.forEach((item) =>
        item.button.classList.remove("workbench__item--active")
      );
      row.button.classList.add("workbench__item--active");
      row.button.scrollIntoView({ block: "nearest" });
      activeIndex = index;

      const embedUrl = buildEmbedUrl(channel);
      player.src = embedUrl;
      player.setAttribute("allow", IFRAME_ALLOW);
      status.textContent = `Canal atual · ${channel.nome}`;
      updateFavoriteButton();
    }

    function createChannelRow(channel, index) {
      const row = document.createElement("div");
      row.className = "workbench__row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "workbench__item";
      button.setAttribute("role", "option");
      button.innerHTML = `<span>${channel.nome}</span>`;
      if (channel.category) {
        const small = document.createElement("small");
        small.textContent = channel.category;
        button.appendChild(small);
      }
      button.addEventListener("click", () => selectChannel(index));

      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "workbench__fav-btn";
      favBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        store.toggle(channel);
        refreshFavoriteMarks();
        if (mode === "favorites" && !store.has(channel.id)) {
          renderChannels(store.list(), { autoSelect: true });
        }
      });

      row.appendChild(button);
      row.appendChild(favBtn);
      return { row, button, favBtn, channel };
    }

    function renderChannels(channels, options = {}) {
      const { autoSelect = true } = options;
      channelList = channels.filter((channel) => buildEmbedUrl(channel));
      channelRows = [];
      grid.innerHTML = "";
      activeIndex = -1;

      if (!channelList.length) {
        status.textContent =
          mode === "favorites"
            ? "Nenhum favorito. Marque canais na aba Rede Buzz."
            : "Nenhum canal encontrado.";
        player.removeAttribute("src");
        if (favToggleBtn) favToggleBtn.hidden = true;
        return;
      }

      channelList.forEach((channel, index) => {
        const entry = createChannelRow(channel, index);
        grid.appendChild(entry.row);
        channelRows.push(entry);
      });

      refreshFavoriteMarks();
      status.textContent =
        mode === "favorites"
          ? `${channelList.length} favorito(s)`
          : `${channelList.length} canal(is) disponível(is)`;

      if (autoSelect) {
        selectChannel(0);
      }
    }

    function selectAdjacentChannel(direction) {
      if (!channelList.length) return;
      const currentIndex = activeIndex >= 0 ? activeIndex : 0;
      const nextIndex =
        (currentIndex + direction + channelList.length) % channelList.length;
      selectChannel(nextIndex);
    }

    global.meuPlayerSelectAdjacentChannel = selectAdjacentChannel;

    function showOverlay() {
      overlay.classList.add("is-visible");
      if (overlayTimer) clearTimeout(overlayTimer);
      overlayTimer = setTimeout(() => {
        overlay.classList.remove("is-visible");
      }, 2600);
    }

    function filterFavoritesLocal(term) {
      const normalized = term.trim().toLowerCase();
      const all = store.list();
      if (!normalized) return all;
      return all.filter((channel) => {
        const haystack = `${channel.nome} ${channel.category} ${channel.id}`.toLowerCase();
        return haystack.includes(normalized);
      });
    }

    async function loadCategories() {
      if (!categorySelect || mode !== "all") return;
      try {
        const response = await fetch("/api/rede-buzz/categories");
        if (!response.ok) return;
        const payload = await response.json();
        const items = Array.isArray(payload.data) ? payload.data : [];
        items.forEach((item) => {
          if (isAdultCategory(item.id) || isAdultCategory(item.name)) return;
          const option = document.createElement("option");
          option.value = item.name || "";
          option.textContent = item.name || item.id || "";
          categorySelect.appendChild(option);
        });
      } catch (error) {
        console.error(error);
      }
    }

    async function loadChannels() {
      status.textContent = "Carregando canais...";
      const category = categorySelect ? categorySelect.value.trim() : "";
      const query = category ? `?category=${encodeURIComponent(category)}` : "";
      const response = await fetch(`/api/rede-buzz/channels${query}`);
      if (!response.ok) {
        throw new Error("Falha ao carregar canais");
      }
      const payload = await response.json();
      renderChannels(extractChannels(payload));
    }

    async function searchChannels(term) {
      status.textContent = "Buscando...";
      const response = await fetch(
        `/api/rede-buzz/search?q=${encodeURIComponent(term)}`
      );
      if (!response.ok) {
        throw new Error("Falha na busca");
      }
      const payload = await response.json();
      renderChannels(extractChannels(payload));
    }

    function loadFavorites() {
      renderChannels(store.list(), { autoSelect: true });
    }

    if (favToggleBtn) {
      favToggleBtn.addEventListener("click", () => {
        const channel = channelList[activeIndex];
        if (!channel) return;
        store.toggle(channel);
        refreshFavoriteMarks();
        if (mode === "favorites" && !store.has(channel.id)) {
          renderChannels(store.list(), { autoSelect: true });
        }
      });
    }

    if (categorySelect && mode === "all") {
      categorySelect.addEventListener("change", () => {
        if (searchInput) searchInput.value = "";
        loadChannels().catch(() => {
          status.textContent = "Erro ao carregar canais.";
        });
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim();
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          if (mode === "favorites") {
            renderChannels(filterFavoritesLocal(term), { autoSelect: true });
            return;
          }
          if (term.length < 2) {
            loadChannels().catch(() => {
              status.textContent = "Erro ao carregar canais.";
            });
            return;
          }
          searchChannels(term).catch(() => {
            status.textContent = "Erro na busca.";
          });
        }, 350);
      });
    }

    global.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (!channelList.length) return;
      event.preventDefault();
      selectAdjacentChannel(event.key === "ArrowUp" ? -1 : 1);
    });

    global.addEventListener("mousemove", showOverlay);
    global.addEventListener("keydown", showOverlay);
    global.addEventListener("meuplayer:rede-buzz-favorites-changed", () => {
      if (mode === "favorites") {
        const term = searchInput ? searchInput.value.trim() : "";
        renderChannels(
          term ? filterFavoritesLocal(term) : store.list(),
          { autoSelect: false }
        );
      } else {
        refreshFavoriteMarks();
      }
    });

    channelUp.addEventListener("click", () => selectAdjacentChannel(-1));
    channelDown.addEventListener("click", () => selectAdjacentChannel(1));

    if (mode === "favorites") {
      loadFavorites();
    } else {
      loadCategories();
      loadChannels().catch(() => {
        status.textContent = "Erro ao carregar canais da Rede Buzz.";
      });
    }
  }

  global.MeuPlayerRedeBuzzUI = { init, buildEmbedUrl, normalizeChannel, extractChannels };
})(window);
