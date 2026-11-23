import { useMemo, useState } from "react";
import Icon from "./Icon";
import Sheet from "./Sheet";
import { parseContent } from "../lib/parse";
import { checkLink } from "../lib/safety";
import { contactToVcf, eventToIcs } from "../lib/encode";
import { textToSvg } from "../lib/qr";
import { isNative, openExternal, timestampName } from "../lib/platform";
import { removeHistory, searchUrl, toast, toggleFavourite, useHistory } from "../lib/store";
import { timeAgo } from "../lib/format";
import {
  copyWithToast,
  saveQrPng,
  shareFile,
  shareQrPng,
  shareTextWithFallback,
} from "../lib/actions";

const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The main thing to do with each kind of content, plus an optional second action. */
function actionsFor(parsed, link) {
  const d = parsed.data;
  switch (parsed.type) {
    case "url":
      return [
        {
          label: link?.level === "warn" ? "Open anyway" : "Open link",
          icon: "open",
          quiet: link?.level === "warn",
          run: () => openExternal(d.url),
        },
      ];
    case "wifi":
      return d.password
        ? [{ label: "Copy password", icon: "copy", run: () => copyWithToast(d.password, "Password copied") }]
        : [{ label: "Copy network name", icon: "copy", run: () => copyWithToast(d.ssid, "Name copied") }];
    case "contact":
      return [
        {
          label: "Save contact",
          icon: "user",
          run: () =>
            shareFile(
              new Blob([contactToVcf(d)], { type: "text/vcard" }),
              `${(d.name || "contact").replace(/[^\w-]+/g, "_")}.vcf`
            ),
        },
        ...(d.phones[0]
          ? [{ label: "Call", icon: "phone", quiet: true, run: () => openExternal(`tel:${d.phones[0]}`) }]
          : []),
        ...(d.emails[0]
          ? [{ label: "Email", icon: "mail", quiet: true, run: () => openExternal(`mailto:${d.emails[0]}`) }]
          : []),
      ];
    case "email": {
      const q = [];
      if (d.subject) q.push(`subject=${encodeURIComponent(d.subject)}`);
      if (d.body) q.push(`body=${encodeURIComponent(d.body)}`);
      return [
        {
          label: "Write email",
          icon: "mail",
          run: () => openExternal(`mailto:${d.to}${q.length ? `?${q.join("&")}` : ""}`),
        },
      ];
    }
    case "sms":
      return [
        {
          label: "Send message",
          icon: "message",
          run: () =>
            openExternal(`sms:${d.number}${d.body ? `?body=${encodeURIComponent(d.body)}` : ""}`),
        },
      ];
    case "phone":
      return [{ label: "Call", icon: "phone", run: () => openExternal(`tel:${d.number}`) }];
    case "geo":
      return [
        {
          label: "Open in maps",
          icon: "pin",
          run: () =>
            openExternal(
              isNative
                ? `geo:${d.lat},${d.lng}?q=${d.lat},${d.lng}`
                : `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`
            ),
        },
      ];
    case "event":
      return [
        {
          label: "Add to calendar",
          icon: "calendar",
          run: () =>
            shareFile(new Blob([eventToIcs(d)], { type: "text/calendar" }), timestampName("event", "ics")),
        },
      ];
    case "otp":
      return [{ label: "Open in authenticator", icon: "key", run: () => openExternal(parsed.raw.trim()) }];
    case "payment":
      return d.scheme === "upi"
        ? [{ label: "Pay with UPI app", icon: "card", run: () => openExternal(parsed.raw.trim()) }]
        : [{ label: "Open in wallet", icon: "card", run: () => openExternal(parsed.raw.trim()) }];
    case "product":
      return [{ label: "Search product", icon: "search", run: () => openExternal(searchUrl(d.code)) }];
    case "book":
      return [
        { label: "Find this book", icon: "book", run: () => openExternal(searchUrl(`ISBN ${d.code}`)) },
      ];
    default:
      return [
        { label: "Copy text", icon: "copy", run: () => copyWithToast(parsed.raw, "Copied") },
        { label: "Search the web", icon: "search", quiet: true, run: () => openExternal(searchUrl(parsed.raw.trim())) },
      ];
  }
}

function LinkCheck({ link }) {
  const heading =
    link.level === "ok" ? "Nothing unusual" : link.level === "caution" ? "Look before you open" : "Suspicious link";
  const prefix = link.host.endsWith(link.domain) ? link.host.slice(0, link.host.length - link.domain.length) : "";
  return (
    <div className={`link-check is-${link.level}`} style={{ "--i": 1 }}>
      <Icon name={link.level === "ok" ? "shield" : "alert"} className="link-check-icon" />
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow">Link check · {heading}</div>
        <div className="link-domain selectable">
          <span>{prefix}</span>
          <b>{link.domain}</b>
        </div>
        {link.notes.length > 0 && (
          <ul>
            {link.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <div className="eyebrow" style={{ marginTop: 8, color: "var(--text-3)" }}>
          On-device check · not a guarantee
        </div>
      </div>
    </div>
  );
}

function ResultContent({ entry, onClose }) {
  const [showCode, setShowCode] = useState(false);
  const [reveal, setReveal] = useState(false);

  const parsed = useMemo(() => parseContent(entry.text, entry.format), [entry.text, entry.format]);
  const link = useMemo(
    () => (parsed.type === "url" ? checkLink(parsed.data.url) : null),
    [parsed]
  );
  const codeSvg = useMemo(
    () => (showCode ? textToSvg(entry.text, { margin: 1 }, 1024) : null),
    [showCode, entry.text]
  );

  const actions = actionsFor(parsed, link);
  const hasSecret = parsed.fields.some((f) => f.secret);
  const saved = !!entry.saved;

  return (
    <>
      <div style={{ "--i": 0 }}>
        <div className="result-badge">
          <Icon name={parsed.icon} size={24} />
        </div>
        <h2 className="result-title selectable">{parsed.title}</h2>
        {parsed.subtitle && parsed.type !== "url" && <div className="result-sub">{parsed.subtitle}</div>}
      </div>

      {link && <LinkCheck link={link} />}

      {parsed.fields.length > 0 && parsed.type !== "url" && (
        <div className="kv" style={{ "--i": 2 }}>
          {parsed.fields.map((f, i) => (
            <button
              key={`${f.label}-${i}`}
              type="button"
              className="kv-row"
              onClick={() => copyWithToast(f.value, `${f.label} copied`)}
            >
              <div className="kv-main">
                <div className="eyebrow">{f.label}</div>
                <div className={`kv-value ${f.secret ? "is-secret" : ""}`}>
                  {f.secret && !reveal ? "•".repeat(Math.min(12, f.value.length)) : f.value}
                </div>
              </div>
              <Icon name="copy" size={18} className="muted" />
            </button>
          ))}
        </div>
      )}

      {(parsed.type === "text" || parsed.type === "url") && (
        <div className="raw-box selectable" style={{ "--i": 2 }}>
          {entry.text}
        </div>
      )}

      <div className="result-actions" style={{ "--i": 3 }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`btn btn-block ${a.quiet ? "btn-ghost" : "btn-primary"}`}
            onClick={a.run}
          >
            <Icon name={a.icon} size={19} />
            {a.label}
          </button>
        ))}
      </div>

      <div className="action-grid" style={{ "--i": 4, marginTop: 10 }}>
        <button type="button" className="action-tile" onClick={() => copyWithToast(entry.text)}>
          <Icon name="copy" />
          Copy
        </button>
        <button type="button" className="action-tile" onClick={() => shareTextWithFallback(entry.text)}>
          <Icon name="share" />
          Share
        </button>
        {hasSecret && (
          <button
            type="button"
            className={`action-tile ${reveal ? "is-on" : ""}`}
            aria-pressed={reveal}
            onClick={() => setReveal((v) => !v)}
          >
            <Icon name={reveal ? "eyeOff" : "eye"} />
            {reveal ? "Hide" : "Reveal"}
          </button>
        )}
        <button
          type="button"
          className={`action-tile ${showCode ? "is-on" : ""}`}
          aria-pressed={showCode}
          onClick={() => setShowCode((v) => !v)}
        >
          <Icon name="qr" />
          Code
        </button>
        {saved && (
          <button
            type="button"
            className={`action-tile ${entry.fav ? "is-on" : ""}`}
            aria-pressed={!!entry.fav}
            onClick={() => toggleFavourite(entry.id)}
          >
            <Icon name="star" filled={!!entry.fav} />
            {entry.fav ? "Starred" : "Star"}
          </button>
        )}
        {saved && (
          <button
            type="button"
            className="action-tile is-danger"
            onClick={() => {
              removeHistory(entry.id);
              toast("Removed from history");
              onClose();
            }}
          >
            <Icon name="trash" />
            Delete
          </button>
        )}
      </div>

      <div className={`code-panel ${showCode ? "is-open" : ""}`} style={{ "--i": 5 }}>
        <div className="code-panel-inner">
          {codeSvg ? (
            <>
              <div className="code-tile">
                <img src={svgDataUrl(codeSvg)} alt="QR code for this content" />
              </div>
              <div className="field-grid">
                <button type="button" className="btn btn-ghost" onClick={() => saveQrPng(codeSvg)}>
                  <Icon name="download" size={18} />
                  Save
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => shareQrPng(codeSvg)}>
                  <Icon name="share" size={18} />
                  Share
                </button>
              </div>
            </>
          ) : (
            showCode && <div className="note is-error">This content is too long for a QR code.</div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Details and actions for one scanned or created code.
 * `entry` is null while closed; the last one is kept so it can animate out.
 */
export default function ResultSheet({ entry, onClose }) {
  const [shown, setShown] = useState(entry);
  if (entry && entry !== shown) setShown(entry);

  const history = useHistory();
  if (!shown) return null;

  // Prefer the stored copy so starring updates live; fall back to the snapshot
  // when history is switched off or the entry was just deleted.
  const stored = history.find((i) => i.id === shown.id);
  const live = stored ? { ...stored, saved: true } : { ...shown, saved: false };
  const parsedLabel = parseContent(live.text, live.format);

  return (
    <Sheet
      open={!!entry}
      onClose={onClose}
      label={`${parsedLabel.label} details`}
      header={
        <div className="sheet-head">
          <div>
            <div className="eyebrow" style={{ color: "var(--text)" }}>
              {live.kind === "create" ? "Created" : "Scanned"} · {parsedLabel.label}
            </div>
            <div className="eyebrow" style={{ marginTop: 5 }}>
              {parsedLabel.formatLabel} · {timeAgo(live.ts)}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
      }
    >
      <ResultContent key={shown.id || shown.ts} entry={live} onClose={onClose} />
    </Sheet>
  );
}
