import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/doto/rond.css";
import "@fontsource-variable/space-grotesk";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-700.css";
import "./styles/app.css";
import App from "./App.jsx";
import { isNative } from "./lib/platform";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Offline support for the web build. The Android app already ships its files.
if (import.meta.env.PROD && !isNative && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
