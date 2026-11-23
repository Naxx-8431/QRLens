import { useDeferredValue, useMemo, useState } from "react";
import Icon from "../components/Icon";
import { Glyph, Segmented } from "../components/controls";
import { parseContent } from "../lib/parse";
import { toggleFavourite, useHistory } from "../lib/store";
import { clockTime, dayLabel } from "../lib/format";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "scan", label: "Scanned" },
  { value: "create", label: "Created" },
  { value: "fav", label: "Starred" },
];

const EMPTY_COPY = {
  all: ["Empty", "Codes you scan or create will collect here."],
  scan: ["No scans", "Scan a code and it will show up here."],
  create: ["No codes", "Codes you save or share from Create appear here."],
  fav: ["No stars", "Star a code to keep it close."],
  search: ["No match", "Nothing in your history matches that search."],
};

export default function HistoryScreen({ active, onOpen }) {
  const history = useHistory();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // Parsing is cheap but there can be hundreds of rows; do it once per change.
  const rows = useMemo(
    () => history.map((item) => ({ item, parsed: parseContent(item.text, item.format) })),
    [history]
  );

  const groups = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const visible = rows.filter(({ item, parsed }) => {
      if (filter === "fav" ? !item.fav : filter !== "all" && item.kind !== filter) return false;
      if (!q) return true;
      return (
        item.text.toLowerCase().includes(q) ||
        parsed.title.toLowerCase().includes(q) ||
        parsed.label.toLowerCase().includes(q)
      );
    });
    const out = [];
    for (const row of visible) {
      const label = dayLabel(row.item.ts);
      const last = out[out.length - 1];
      if (last?.label === label) last.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [rows, filter, deferredQuery]);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const empty = EMPTY_COPY[query.trim() ? "search" : filter];
  let index = 0;

  return (
    <section className={`screen ${active ? "is-active" : ""}`} aria-label="History" aria-hidden={!active}>
      <div className="page">
        <header className="page-head rise" style={{ "--i": 0 }}>
          <div>
            <div className="eyebrow">
              {history.length} saved · {history.filter((i) => i.fav).length} starred
            </div>
            <h1 className="page-title display">
              History<span className="dot" />
            </h1>
          </div>
        </header>

        <div className="history-sticky rise" style={{ "--i": 1 }}>
          <div className="history-tools">
            <div className="search">
              <Icon name="search" size={19} />
              <input
                className="input"
                type="search"
                placeholder="Search history"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search history"
                enterKeyHint="search"
              />
            </div>
            <Segmented label="Filter" options={FILTERS} value={filter} onChange={setFilter} />
          </div>
        </div>

        {total === 0 ? (
          <div className="empty rise" style={{ "--i": 2 }}>
            <Glyph />
            <div className="display">{empty[0]}</div>
            <div>{empty[1]}</div>
          </div>
        ) : (
          <div key={`${filter}`} className="rise" style={{ "--i": 2 }}>
            {groups.map((group) => (
              <div key={group.label}>
                <div className="section-label eyebrow">{group.label}</div>
                <div className="card">
                  {group.rows.map(({ item, parsed }) => (
                    <div className="item" key={item.id} style={{ "--i": index++ }}>
                      <button type="button" className="item-main" onClick={() => onOpen(item)}>
                        <span className="item-icon">
                          <Icon name={parsed.icon} size={20} />
                        </span>
                        <span className="item-text">
                          <span className="item-title" style={{ display: "block" }}>
                            {parsed.title}
                          </span>
                          <span className="item-meta eyebrow" style={{ display: "block" }}>
                            {parsed.label} · {item.kind === "create" ? "Created" : parsed.formatLabel} ·{" "}
                            {clockTime(item.ts)}
                            {item.count > 1 ? ` · ×${item.count}` : ""}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`item-star ${item.fav ? "is-on" : ""}`}
                        aria-label={item.fav ? "Remove star" : "Add star"}
                        aria-pressed={!!item.fav}
                        onClick={() => toggleFavourite(item.id)}
                      >
                        <Icon name="star" size={20} filled={!!item.fav} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
