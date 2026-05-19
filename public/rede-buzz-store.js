(function (global) {
  const STORAGE_KEY = "meuplayer.rede-buzz.favorites";

  function readMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeMap(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    global.dispatchEvent(
      new CustomEvent("meuplayer:rede-buzz-favorites-changed", {
        detail: { count: Object.keys(map).length },
      })
    );
  }

  function channelKey(channel) {
    return String(channel?.id || "").trim();
  }

  function isAdultChannel(channel) {
    return String(channel?.category || "").trim().toLowerCase() === "adulto";
  }

  const MeuPlayerRedeBuzzStore = {
    list() {
      const map = readMap();
      const kept = {};
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

    has(id) {
      const key = String(id || "").trim();
      if (!key) return false;
      return Boolean(readMap()[key]);
    },

    toggle(channel) {
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

    remove(id) {
      const key = String(id || "").trim();
      if (!key) return;
      const map = readMap();
      if (!map[key]) return;
      delete map[key];
      writeMap(map);
    },

    count() {
      return Object.keys(readMap()).length;
    },
  };

  global.MeuPlayerRedeBuzzStore = MeuPlayerRedeBuzzStore;
})(window);
