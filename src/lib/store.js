import { useSyncExternalStore } from "react";
import { isNative } from "./platform";

/* Small localStorage-backed stores: settings, history, and transient toasts. */

function createStore(key, initial, { persist = true } = {}) {
  let value = initial;
  if (persist) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved != null) {
        value = Array.isArray(initial) ? saved : { ...initial, ...saved };
      }
    } catch {
      /* corrupt or unavailable storage: start fresh */
    }
  }
  const listeners = new Set();
  const get = () => value;
  const set = (next) => {
    value = typeof next === "function" ? next(value) : next;
    if (persist) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage full or blocked: keep working in memory */
      }
    }
    listeners.forEach((fn) => fn());
  };
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  return { get, set, subscribe };
}

/* ---------- settings ---------- */

export const DEFAULT_SETTINGS = {
  vibrate: true,
  beep: false,
  autoCopy: false,
  autoOpen: false,
  batch: false,
  saveHistory: true,
  // Opening straight into the camera is what people expect from an app;
  // on the web an unprompted permission dialog is rude, so wait for a tap.
  autoStart: isNative,
  searchEngine: "google",
};

export const SEARCH_ENGINES = {
  google: { label: "Google", url: "https://www.google.com/search?q=" },
  duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
};

const settingsStore = createStore("qrlens.settings", DEFAULT_SETTINGS);

export const getSettings = () => settingsStore.get();
export const setSetting = (key, value) => settingsStore.set((s) => ({ ...s, [key]: value }));
export const useSettings = () => useSyncExternalStore(settingsStore.subscribe, settingsStore.get);

export const searchUrl = (query) =>
  (SEARCH_ENGINES[getSettings().searchEngine] || SEARCH_ENGINES.google).url +
  encodeURIComponent(query);

/* ---------- history ---------- */

const MAX_ITEMS = 500;
const historyStore = createStore("qrlens.history", []);

export const useHistory = () => useSyncExternalStore(historyStore.subscribe, historyStore.get);

const makeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Adds an entry, or bumps an identical one to the top instead of duplicating it.
 * Returns the stored entry.
 */
export function addHistory({ kind, text, format = "qr_code" }) {
  let entry;
  historyStore.set((items) => {
    const existing = items.find((i) => i.kind === kind && i.text === text && i.format === format);
    entry = existing
      ? { ...existing, ts: Date.now(), count: (existing.count || 1) + 1 }
      : { id: makeId(), kind, text, format, ts: Date.now(), fav: false, count: 1 };
    const rest = existing ? items.filter((i) => i.id !== existing.id) : items;
    const next = [entry, ...rest];
    if (next.length <= MAX_ITEMS) return next;
    // Trim the oldest entries, but never throw away something the user starred.
    let overflow = next.length - MAX_ITEMS;
    return next
      .slice()
      .reverse()
      .filter((i) => i.fav || i.id === entry.id || overflow-- <= 0)
      .reverse();
  });
  return entry;
}

export const toggleFavourite = (id) =>
  historyStore.set((items) => items.map((i) => (i.id === id ? { ...i, fav: !i.fav } : i)));

export const removeHistory = (id) => historyStore.set((items) => items.filter((i) => i.id !== id));

export const clearHistory = () => historyStore.set([]);

export function historyToCsv(items) {
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = items.map((i) =>
    [new Date(i.ts).toISOString(), i.kind === "scan" ? "scanned" : "created", i.format, i.fav ? "yes" : "no", i.text]
      .map(cell)
      .join(",")
  );
  return ["date,source,format,favourite,content", ...rows].join("\r\n");
}

/* ---------- toasts ---------- */

const toastStore = createStore("", [], { persist: false });
export const useToasts = () => useSyncExternalStore(toastStore.subscribe, toastStore.get);

export function toast(message, { tone = "default", duration = 2200 } = {}) {
  const id = makeId();
  toastStore.set((list) => [...list.slice(-2), { id, message, tone }]);
  setTimeout(() => toastStore.set((list) => list.filter((t) => t.id !== id)), duration);
}
