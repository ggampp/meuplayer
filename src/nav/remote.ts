/** SSE remote-control receiver used by all pages that load the hub. */
export function initRemoteReceiver(): void {
  const SESSION_KEY = "meuplayer_remote_session";
  let evtSource: EventSource | null = null;

  function handleCommand(cmd: { action?: string; value?: string }): void {
    const action = String(cmd.action || "");
    const value = String(cmd.value || "");
    if (action === "navigate" && value.startsWith("/")) {
      window.location.href = value;
    } else if (action === "search") {
      window.dispatchEvent(
        new CustomEvent("meuplayer:remote-search", { detail: { term: value } })
      );
    } else if (action === "channel_up") {
      window.meuPlayerSelectAdjacentChannel?.(-1);
    } else if (action === "channel_down") {
      window.meuPlayerSelectAdjacentChannel?.(1);
    } else if (action.startsWith("key_")) {
      const keyMap: Record<string, string> = {
        key_up: "ArrowUp",
        key_down: "ArrowDown",
        key_left: "ArrowLeft",
        key_right: "ArrowRight",
        key_ok: "Enter",
        key_back: "Escape",
      };
      const mappedKey = keyMap[action];
      if (mappedKey) {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: mappedKey,
            bubbles: true,
            cancelable: true,
          })
        );
      }
    }
  }

  function connect(token: string): void {
    if (evtSource) {
      evtSource.close();
      evtSource = null;
    }
    evtSource = new EventSource(
      "/api/remote/events?session=" + encodeURIComponent(token)
    );
    evtSource.onmessage = (event) => {
      try {
        handleCommand(JSON.parse(event.data));
      } catch {
        /* ignore malformed */
      }
    };
    evtSource.onerror = () => {
      evtSource?.close();
      evtSource = null;
      setTimeout(() => connect(token), 5000);
    };
  }

  const storedToken = localStorage.getItem(SESSION_KEY);
  if (storedToken) connect(storedToken);

  window.addEventListener("meuplayer:remote-session-ready", ((e: CustomEvent) => {
    const token = e.detail && e.detail.token;
    if (token) {
      localStorage.setItem(SESSION_KEY, token);
      connect(token);
    }
  }) as EventListener);
}
