const API_BASE = "https://superflixapi.one";
const LIST_ENDPOINT = `${API_BASE}/lista`;

const state = {
  lists: {},
  featured: null,
  search: "",
};

const categories = [
  { key: "movie", label: "Filmes" },
  { key: "serie", label: "Séries" },
  { key: "anime", label: "Animes" },
];

const rowsContainer = document.getElementById("rowsContainer");
const rowsStatus = document.getElementById("rowsStatus");
const searchInput = document.getElementById("searchInput");
const heroPlay = document.getElementById("heroPlay");
const heroInfo = document.getElementById("heroInfo");
const heroMeta = document.getElementById("heroMeta");

const modal = document.getElementById("playerModal");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalType = document.getElementById("modalType");
const modalId = document.getElementById("modalId");
const modalSeason = document.getElementById("modalSeason");
const modalEpisode = document.getElementById("modalEpisode");
const modalUpdate = document.getElementById("modalUpdate");
const playerFrame = document.getElementById("playerFrame");

const heroState = { id: "", type: "movie" };

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

async function fetchList(category) {
  const url = new URL(LIST_ENDPOINT);
  url.searchParams.set("category", category);
  url.searchParams.set("type", "tmdb");
  url.searchParams.set("format", "json");
  url.searchParams.set("order", "asc");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${category}`);
  }
  const data = await response.json();
  return normalizeList(data);
}

function createCard(id, type) {
  const button = document.createElement("button");
  button.className = "card";
  button.type = "button";
  button.innerHTML = `
    <span class="card__type">${type}</span>
    <span class="card__id">${id}</span>
    <span class="card__action">Assistir agora</span>
  `;
  button.addEventListener("click", () => openModal({ id, type }));
  return button;
}

function renderRows() {
  rowsContainer.innerHTML = "";
  const search = state.search.trim().toLowerCase();
  categories.forEach((category) => {
    const list = state.lists[category.key] || [];
    const filtered = search
      ? list.filter((id) => id.toLowerCase().includes(search))
      : list;

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row__title">${category.label}</div>
      <div class="row__scroller"></div>
    `;
    const scroller = row.querySelector(".row__scroller");

    const items = filtered.slice(0, 50);
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "rows__status";
      empty.textContent = "Nenhum item encontrado.";
      row.appendChild(empty);
    } else {
      items.forEach((id) => scroller.appendChild(createCard(id, category.key)));
    }
    rowsContainer.appendChild(row);
  });
}

function updateHero() {
  if (!state.featured) {
    heroMeta.textContent = "Nenhum item encontrado.";
    heroPlay.disabled = true;
    heroInfo.disabled = true;
    return;
  }
  heroState.id = state.featured.id;
  heroState.type = state.featured.type;
  heroMeta.textContent = `ID em destaque: ${state.featured.id} (${state.featured.type})`;
  heroPlay.disabled = false;
  heroInfo.disabled = false;
}

function buildPlayerUrl({ id, type, season, episode }) {
  if (!id || !type) return "";
  if (type === "movie") {
    return `${API_BASE}/filme/${id}`;
  }
  const seasonValue = season || "1";
  const episodeValue = episode || "1";
  return `${API_BASE}/serie/${id}/${seasonValue}/${episodeValue}`;
}

function openModal({ id, type }) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  modalType.value = type === "movie" ? "movie" : "serie";
  modalId.value = id;
  modalSeason.value = "1";
  modalEpisode.value = "1";
  modalMeta.textContent = "Atualize temporada/episódio para séries.";
  modalTitle.textContent = `Player ${type}`;
  updatePlayerFrame();
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  playerFrame.src = "";
}

function updatePlayerFrame() {
  const type = modalType.value;
  const id = modalId.value.trim();
  const season = modalSeason.value;
  const episode = modalEpisode.value;
  const url = buildPlayerUrl({ id, type, season, episode });
  playerFrame.src = url;
  modalTitle.textContent = `Player ${type}`;
  modalMeta.textContent = url ? `URL: ${url}` : "Informe um ID válido.";
  modalSeason.disabled = type === "movie";
  modalEpisode.disabled = type === "movie";
}

async function loadCatalog() {
  try {
    rowsStatus.textContent = "Carregando...";
    const results = await Promise.all(
      categories.map((category) => fetchList(category.key))
    );
    categories.forEach((category, index) => {
      state.lists[category.key] = results[index];
    });
    const featuredId =
      state.lists.movie?.[0] ||
      state.lists.serie?.[0] ||
      state.lists.anime?.[0];
    if (featuredId) {
      state.featured = { id: featuredId, type: "movie" };
    }
    updateHero();
    renderRows();
    rowsStatus.textContent = "Catálogo atualizado";
  } catch (error) {
    rowsStatus.textContent = "Erro ao carregar catálogo";
    heroMeta.textContent =
      "Falha ao carregar a API. Verifique sua conexão.";
    console.error(error);
  }
}

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderRows();
});

heroPlay.addEventListener("click", () => openModal(heroState));
heroInfo.addEventListener("click", () => openModal(heroState));

document.querySelectorAll("[data-close]").forEach((element) => {
  element.addEventListener("click", closeModal);
});

modalUpdate.addEventListener("click", updatePlayerFrame);
modalType.addEventListener("change", updatePlayerFrame);

document.querySelectorAll(".nav__item").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.scroll;
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

loadCatalog();
