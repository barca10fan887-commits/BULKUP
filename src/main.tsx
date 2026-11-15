import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Service worker only on the web; the native app bundles its files.
if (!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
  // Check for a new version on launch, whenever the app comes back to the foreground, and hourly.
  // Home-screen apps on iPhone otherwise keep an old copy for a long time.
  import("virtual:pwa-register")
    .then(({ registerSW }) =>
      registerSW({
        immediate: true,
        onRegisteredSW(_url, reg) {
          if (!reg) return;
          const check = () => reg.update().catch(() => {});
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
          setInterval(check, 60 * 60 * 1000);
        },
      }),
    )
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
