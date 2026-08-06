import {
  CATALOG_LIST_PATHS,
  CATALOG_PREFIXES,
  TV_PREFIXES,
  type NativePlatform,
  type StreamingProvider,
} from "./config";

export function normalizePath(path: string): string {
  return (path || "/").replace(/\/$/, "") || "/";
}

export function createRouteContext(pathname = window.location.pathname, search = window.location.search) {
  const currentPath = normalizePath(pathname);
  const currentParams = new URLSearchParams(search);
  const activePlayerUrl = currentParams.get("url") || "";
  const activeProviderId = currentParams.get("providerId") || "";

  function isCatalogListPage(): boolean {
    return CATALOG_LIST_PATHS.has(currentPath);
  }

  function isMeuPlayerActive(): boolean {
    if (currentPath === "/") return true;
    return CATALOG_PREFIXES.some(
      (p) => currentPath === p || currentPath.startsWith(p + "/")
    );
  }

  function isTvActive(): boolean {
    return TV_PREFIXES.some(
      (p) => currentPath === p || currentPath.startsWith(p + "/")
    );
  }

  function isExternalPlayerActive(): boolean {
    return currentPath === "/player";
  }

  function isLinkActive(linkPath: string): boolean {
    const normalized = normalizePath(linkPath);
    if (normalized === "/") return currentPath === "/";
    return currentPath === normalized || currentPath.startsWith(normalized + "/");
  }

  function isNativeActive(platform: NativePlatform): boolean {
    if (platform.id === "meuplayer") return isMeuPlayerActive();
    if (platform.id === "tv") return isTvActive();
    return false;
  }

  function isExternalProviderActive(provider: StreamingProvider): boolean {
    if (!isExternalPlayerActive()) return false;
    if (activeProviderId && provider.id && activeProviderId === provider.id) {
      return true;
    }
    if (!activePlayerUrl || !provider.url) return false;
    return (
      activePlayerUrl === provider.url ||
      activePlayerUrl.includes(provider.url) ||
      provider.url.includes(activePlayerUrl)
    );
  }

  function playerHref(provider: StreamingProvider): string {
    const q = new URLSearchParams();
    q.set("url", provider.url || "");
    q.set("name", provider.name || "");
    if (provider.icon) q.set("icon", provider.icon);
    if (provider.id) q.set("providerId", provider.id);
    return "/player?" + q.toString();
  }

  return {
    currentPath,
    activePlayerUrl,
    activeProviderId,
    isCatalogListPage,
    isMeuPlayerActive,
    isTvActive,
    isExternalPlayerActive,
    isLinkActive,
    isNativeActive,
    isExternalProviderActive,
    playerHref,
  };
}

export type RouteContext = ReturnType<typeof createRouteContext>;
