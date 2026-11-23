import { useToasts } from "../lib/store";
import Icon from "./Icon";

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented({ options, value, onChange, label }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className="segmented"
      role="group"
      aria-label={label}
      style={{ "--count": options.length, "--index": index }}
    >
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label eyebrow">{label}</span>
      {children}
    </label>
  );
}

export function SettingRow({ title, hint, checked, onChange }) {
  return (
    <div className="row">
      <div className="row-body">
        <div className="row-title">{title}</div>
        {hint && <div className="row-sub">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass ${t.tone === "error" ? "is-error" : ""}`}>
          <i />
          {t.message}
        </div>
      ))}
    </div>
  );
}

const NAV_ITEMS = [
  { id: "scan", label: "Scan", icon: "scan" },
  { id: "create", label: "Create", icon: "create" },
  { id: "history", label: "History", icon: "history" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function NavBar({ tab, onChange }) {
  const index = NAV_ITEMS.findIndex((n) => n.id === tab);
  return (
    <nav className="nav glass" aria-label="Sections" style={{ "--index": index }}>
      <span className="nav-indicator" aria-hidden="true" />
      {NAV_ITEMS.map((n) => (
        <button
          key={n.id}
          type="button"
          className={`nav-item ${n.id === tab ? "is-active" : ""}`}
          aria-current={n.id === tab ? "page" : undefined}
          aria-label={n.label}
          title={n.label}
          onClick={() => onChange(n.id)}
        >
          <Icon name={n.icon} size={25} strokeWidth={1.8} />
        </button>
      ))}
    </nav>
  );
}

/* 7×7 dot-matrix emblem: a QR finder pattern with one signal-red dot. */
const GLYPH = [
  "1111111",
  "1000001",
  "1011101",
  "1012101",
  "1011101",
  "1000001",
  "1111111",
];

export function Glyph({ busy = false }) {
  return (
    <div className={`glyph ${busy ? "is-busy" : ""}`} aria-hidden="true">
      {GLYPH.flatMap((row, r) =>
        row.split("").map((cell, c) => (
          <i
            key={`${r}-${c}`}
            className={cell === "2" ? "on hot" : cell === "1" ? "on" : ""}
            style={{ "--d": r + c }}
          />
        ))
      )}
    </div>
  );
}
