/**
 * MeuPlayer - Platform Hub navigation (typed)
 * Primary rail: MeuPlayer + TV + external streamings
 * Secondary row: catalog or TV sections
 */
import {
  CATALOG_LINKS,
  DEFAULT_PROVIDERS,
  HUB_CACHE_NAME,
  ICONS,
  NATIVE_PLATFORMS,
  TV_LINKS,
  UTILITY_LINKS,
  type NativePlatform,
  type StreamingProvider,
} from "./nav/config";
import { el, ensureHubStylesheet, injectIcons, purgeLegacyShellCaches } from "./nav/dom";
import { initRemoteReceiver } from "./nav/remote";
import { createRouteContext } from "./nav/routes";

purgeLegacyShellCaches(HUB_CACHE_NAME);

const route = createRouteContext();

function openProviderModal(): void {
  if (window.MeuPlayerProviderModal) {
    window.MeuPlayerProviderModal.open();
    return;
  }
  const script = document.createElement("script");
  script.type = "module";
  script.src = "/js/provider-modal.js";
  script.onload = () => {
    window.MeuPlayerProviderModal?.open();
  };
  document.body.appendChild(script);
}

function fillSelect(
  select: HTMLSelectElement,
  options: Array<{ value: string; label: string; selected?: boolean }>,
  isSelected: (opt: { value: string; label: string; selected?: boolean }) => boolean
): void {
  select.innerHTML = "";
  options.forEach((opt) => {
    const option = el("option", { value: opt.value }, opt.label);
    if (isSelected(opt)) option.selected = true;
    select.appendChild(option);
  });
}

function buildNativeChip(platform: NativePlatform): HTMLAnchorElement {
  const active = route.isNativeActive(platform);
  const classes = [
    "app-nav__chip",
    "app-nav__chip--native",
    active ? "app-nav__chip--active" : "",
    platform.live && active ? "app-nav__chip--live" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const chip = el("a", {
    className: classes,
    href: platform.path,
    title: platform.title,
    "aria-current": active ? "page" : null,
  });

  if (platform.icon && ICONS[platform.icon]) {
    chip.appendChild(
      el("span", { className: "app-nav__chip-icon", html: ICONS[platform.icon] })
    );
  }
  chip.appendChild(document.createTextNode(platform.name));
  return chip as HTMLAnchorElement;
}

function buildExternalChip(provider: StreamingProvider): HTMLAnchorElement {
  const active = route.isExternalProviderActive(provider);
  const chip = el("a", {
    className: "app-nav__chip" + (active ? " app-nav__chip--active" : ""),
    href: route.playerHref(provider),
    title: "Abrir " + provider.name,
    "aria-current": active ? "page" : null,
  }) as HTMLAnchorElement;

  if (provider.icon) {
    const img = el("img", {
      src: provider.icon,
      alt: "",
    }) as HTMLImageElement;
    img.onerror = () => {
      img.src = "/img/providers/default-provider.svg";
    };
    chip.appendChild(img);
  }
  chip.appendChild(el("span", null, provider.name));
  return chip;
}

function buildAddButton(): HTMLButtonElement {
  return el(
    "button",
    {
      type: "button",
      className: "app-nav__add",
      title: "Cadastrar nova plataforma de vídeo",
      onClick: openProviderModal,
    },
    el("span", { className: "app-nav__add-icon", html: "+" }),
    el("span", null, "Novo")
  ) as HTMLButtonElement;
}

function createHub(): void {
  injectIcons();
  ensureHubStylesheet();

  const nav = el("nav", {
    className: "app-nav",
    attrs: { "aria-label": "Hub de plataformas" },
  });

  const primaryRow = el("div", { className: "app-nav__row app-nav__row--primary" });
  nav.appendChild(primaryRow);

  primaryRow.appendChild(
    el(
      "a",
      {
        className: "app-nav__logo",
        href: "/",
        title: "MeuPlayer - catálogo",
      },
      "MeuPlayer"
    )
  );

  const platformsContainer = el("div", {
    className: "app-nav__platforms",
    attrs: {
      "aria-label": "Plataformas de vídeo",
      role: "navigation",
    },
  });
  primaryRow.appendChild(platformsContainer);

  const platformSelect = el("select", {
    className: "app-nav__mobile-select",
    attrs: { "aria-label": "Plataforma" },
    onChange: () => {
      window.location.href = platformSelect.value;
    },
  }) as HTMLSelectElement;
  primaryRow.appendChild(platformSelect);

  const utilities = el("div", { className: "app-nav__utilities" });
  UTILITY_LINKS.forEach(({ label, path, icon }) => {
    const active = route.isLinkActive(path);
    const link = el("a", {
      className: "app-nav__util" + (active ? " app-nav__util--active" : ""),
      href: path,
      title: label,
      "aria-current": active ? "page" : null,
    });
    if (icon && ICONS[icon]) {
      link.insertAdjacentHTML("beforeend", ICONS[icon]);
    }
    link.appendChild(el("span", { className: "app-nav__util-label" }, label));
    utilities.appendChild(link);
  });
  primaryRow.appendChild(utilities);

  const showMeuPlayerSub = route.isMeuPlayerActive();
  const showTvSub = route.isTvActive();

  if (showMeuPlayerSub || showTvSub) {
    const secondaryRow = el("div", {
      className: "app-nav__row app-nav__row--secondary",
    });
    nav.appendChild(secondaryRow);

    const links = showMeuPlayerSub ? CATALOG_LINKS : TV_LINKS;
    const subnav = el("div", {
      className: "app-nav__subnav",
      attrs: {
        "aria-label": showMeuPlayerSub ? "Seções do catálogo" : "Seções da TV",
      },
    });

    links.forEach(({ label, path }) => {
      const active = route.isLinkActive(path);
      subnav.appendChild(
        el(
          "a",
          {
            className: "app-nav__link" + (active ? " app-nav__link--active" : ""),
            href: path,
            "aria-current": active ? "page" : null,
          },
          label
        )
      );
    });
    secondaryRow.appendChild(subnav);

    const sectionSelect = el("select", {
      className: "app-nav__mobile-select",
      attrs: { "aria-label": "Seção" },
      onChange: () => {
        window.location.href = sectionSelect.value;
      },
    }) as HTMLSelectElement;
    fillSelect(
      sectionSelect,
      links.map((l) => ({ value: l.path, label: l.label })),
      (opt) => route.isLinkActive(opt.value)
    );
    secondaryRow.appendChild(sectionSelect);

    if (showMeuPlayerSub && route.isCatalogListPage()) {
      secondaryRow.appendChild(
        el("div", {
          id: "catalogFilters",
          className: "app-nav__filters",
          attrs: { "aria-label": "Filtros do catálogo" },
        })
      );
    }
  }

  function renderPlatformsSync(externalProviders: StreamingProvider[]): void {
    platformsContainer.innerHTML = "";
    const selectOptions: Array<{ value: string; label: string; selected?: boolean }> =
      [];

    NATIVE_PLATFORMS.forEach((platform) => {
      platformsContainer.appendChild(buildNativeChip(platform));
      selectOptions.push({
        value: platform.path,
        label: platform.name,
        selected: route.isNativeActive(platform),
      });
    });

    platformsContainer.appendChild(
      el("span", {
        className: "app-nav__divider",
        attrs: { "aria-hidden": "true" },
      })
    );

    (externalProviders || []).forEach((provider) => {
      platformsContainer.appendChild(buildExternalChip(provider));
      selectOptions.push({
        value: route.playerHref(provider),
        label: provider.name,
        selected: route.isExternalProviderActive(provider),
      });
    });

    platformsContainer.appendChild(buildAddButton());
    fillSelect(platformSelect, selectOptions, (opt) => !!opt.selected);
  }

  async function loadPlatforms(): Promise<void> {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const list = (await res.json()) as StreamingProvider[];
        if (Array.isArray(list) && list.length > 0) {
          renderPlatformsSync(list);
          publishNavOffset();
          return;
        }
      }
    } catch (e) {
      console.warn("Usando plataformas padrão para navegação:", e);
    }
    renderPlatformsSync(DEFAULT_PROVIDERS);
    publishNavOffset();
  }

  function publishNavOffset(): void {
    const h = Math.ceil(nav.getBoundingClientRect().height) || 56;
    document.documentElement.style.setProperty("--app-nav-offset", h + "px");
  }

  renderPlatformsSync(DEFAULT_PROVIDERS);
  loadPlatforms();
  window.addEventListener("meuplayer:providers-changed", () => {
    void loadPlatforms();
  });

  function inject(): void {
    document.body.insertBefore(nav, document.body.firstChild);
    publishNavOffset();
    window.addEventListener("resize", publishNavOffset);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(publishNavOffset);
      ro.observe(nav);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
}

createHub();
initRemoteReceiver();
