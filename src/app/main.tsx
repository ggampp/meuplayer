import { createRoot } from "react-dom/client";
import { App } from "../modules/vod/pages/VodApp";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
