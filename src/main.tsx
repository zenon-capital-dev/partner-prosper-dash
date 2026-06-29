import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recover from stale dynamic import chunks after a new deploy.
const isChunkLoadError = (msg?: string) =>
  !!msg &&
  (msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module"));

const tryReload = () => {
  try {
    const key = "__chunk_reload_at";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
};

window.addEventListener("error", (e) => {
  if (isChunkLoadError(e?.message)) tryReload();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e?.reason && (e.reason.message || String(e.reason))) || "";
  if (isChunkLoadError(msg)) tryReload();
});

createRoot(document.getElementById("root")!).render(<App />);
