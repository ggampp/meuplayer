/**
 * Favorites store for Rede Buzz / live TV channels.
 */
export interface BuzzChannel {
  id: string;
  nome?: string;
  name?: string;
  src?: string;
  embed_url?: string;
  category?: string;
}

const STORAGE_KEY = "meuplayer.rede-buzz.favorites";

function readMap(): Record<string, BuzzChannel> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, BuzzChannel>)
      : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, BuzzChannel>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(
    new CustomEvent("meuplayer:rede-buzz-favorites-changed", {
      detail: { count: Object.keys(map).length },
    })
  );
}

function channelKey(channel: BuzzChannel | null | undefined): string {
  return String(channel?.id || "").trim();
}

function isAdultChannel(channel: BuzzChannel | null | undefined): boolean {
  return String(channel?.category || "").trim().toLowerCase() === "adulto";
}

export const MeuPlayerRedeBuzzStore = {
  list(): BuzzChannel[] {
    const map = readMap();
    const kept: Record<string, BuzzChannel> = {};
    Object.values(map).forEach((channel) => {
      if (isAdultChannel(channel)) return;
      const key = channelKey(channel);
      if (key) kept[key] = channel;
    });
    if (Object.keys(kept).length !== Object.keys(map).length) {
      writeMap(kept);
    }
    return Object.values(kept).sort((a, b) =>
      (a.nome || a.id || "").localeCompare(b.nome || b.id || "", "pt-BR")
    );
  },

  has(id: string | number | null | undefined): boolean {
    const key = String(id || "").trim();
    if (!key) return false;
    return Boolean(readMap()[key]);
  },

  toggle(channel: BuzzChannel): boolean {
    const key = channelKey(channel);
    if (!key || isAdultChannel(channel)) return false;
    const map = readMap();
    if (map[key]) {
      delete map[key];
      writeMap(map);
      return false;
    }
    map[key] = {
      id: key,
      nome: channel.nome || channel.name || key,
      src: channel.src || channel.embed_url || "",
      category: channel.category || "",
    };
    writeMap(map);
    return true;
  },

  remove(id: string | number | null | undefined): void {
    const key = String(id || "").trim();
    if (!key) return;
    const map = readMap();
    if (!map[key]) return;
    delete map[key];
    writeMap(map);
  },

  count(): number {
    return Object.keys(readMap()).length;
  },
};

window.MeuPlayerRedeBuzzStore = MeuPlayerRedeBuzzStore;
