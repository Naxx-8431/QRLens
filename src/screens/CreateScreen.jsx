import { memo, useDeferredValue, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import { Field, Glyph, Segmented, Toggle } from "../components/controls";
import { buildPayload, CREATE_TYPES, EMPTY_FORMS } from "../lib/encode";
import { COLOR_PRESETS, contrastRatio, DEFAULT_STYLE, makeMatrix, renderSvg } from "../lib/qr";
import { addHistory, getSettings, toast } from "../lib/store";
import { copyQrPng, saveQrPng, saveQrSvg, shareQrPng } from "../lib/actions";

const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const DOT_OPTIONS = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Soft" },
  { value: "dots", label: "Dots" },
];
const EYE_OPTIONS = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Soft" },
  { value: "circle", label: "Round" },
];
const EC_OPTIONS = [
  { value: "L", label: "Low" },
  { value: "M", label: "Medium" },
  { value: "Q", label: "High" },
  { value: "H", label: "Max" },
];
const SIZE_OPTIONS = [
  { value: 512, label: "512" },
  { value: 1024, label: "1024" },
  { value: 2048, label: "2048" },
];
const SECURITY_OPTIONS = [
  { value: "WPA", label: "WPA" },
  { value: "WEP", label: "WEP" },
  { value: "nopass", label: "Open" },
];

/** Shrinks a picked logo so it does not bloat every exported file. */
function readLogo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    img.src = url;
  });
}

function TypeForm({ type, form, set }) {
  const text = (key, label, props = {}) => (
    <Field label={label}>
      <input
        className="input"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        {...props}
      />
    </Field>
  );
  const area = (key, label, props = {}) => (
    <Field label={label}>
      <textarea
        className="input"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        {...props}
      />
    </Field>
  );

  switch (type) {
    case "text":
      return area("text", "Text", { placeholder: "Type or paste anything", rows: 5 });
    case "url":
      return text("url", "Web address", { placeholder: "example.com", inputMode: "url", type: "url" });
    case "wifi":
      return (
        <>
          {text("ssid", "Network name", { placeholder: "My Wi-Fi" })}
          <div className="field">
            <span className="field-label eyebrow">Security</span>
            <Segmented
              label="Security"
              options={SECURITY_OPTIONS}
              value={form.security}
              onChange={(v) => set("security", v)}
            />
          </div>
          {form.security !== "nopass" && text("password", "Password", { placeholder: "Network password" })}
          <div className="row" style={{ padding: "12px 4px 0", minHeight: 0 }}>
            <div className="row-body">
              <div className="row-title">Hidden network</div>
            </div>
            <Toggle checked={form.hidden} onChange={(v) => set("hidden", v)} label="Hidden network" />
          </div>
        </>
      );
    case "contact":
      return (
        <>
          <div className="field-grid">
            {text("first", "First name", { placeholder: "Ada", autoCapitalize: "words" })}
            {text("last", "Last name", { placeholder: "Lovelace", autoCapitalize: "words" })}
          </div>
          {text("phone", "Phone", { placeholder: "+971 50 000 0000", inputMode: "tel", type: "tel" })}
          {text("email", "Email", { placeholder: "name@example.com", inputMode: "email", type: "email" })}
          <div className="field-grid">
            {text("org", "Company", { placeholder: "Optional", autoCapitalize: "words" })}
            {text("title", "Job title", { placeholder: "Optional", autoCapitalize: "words" })}
          </div>
          {text("url", "Website", { placeholder: "Optional", inputMode: "url" })}
          {text("address", "Address", { placeholder: "Optional", autoCapitalize: "words" })}
        </>
      );
    case "email":
      return (
        <>
          {text("to", "To", { placeholder: "name@example.com", inputMode: "email", type: "email" })}
          {text("subject", "Subject", { placeholder: "Optional", autoCapitalize: "sentences" })}
          {area("body", "Message", { placeholder: "Optional", rows: 4 })}
        </>
      );
    case "sms":
      return (
        <>
          {text("number", "Phone number", { placeholder: "+971 50 000 0000", inputMode: "tel", type: "tel" })}
          {area("body", "Message", { placeholder: "Optional", rows: 4 })}
        </>
      );
    case "phone":
      return text("number", "Phone number", { placeholder: "+971 50 000 0000", inputMode: "tel", type: "tel" });
    case "geo":
      return (
        <div className="field-grid">
          {text("lat", "Latitude", { placeholder: "25.19720", inputMode: "decimal" })}
          {text("lng", "Longitude", { placeholder: "55.27440", inputMode: "decimal" })}
        </div>
      );
    case "event":
      return (
        <>
          {text("title", "Title", { placeholder: "Launch day", autoCapitalize: "sentences" })}
          <div className="field-grid is-dates">
            {text("start", "Starts", { type: "datetime-local" })}
            {text("end", "Ends", { type: "datetime-local" })}
          </div>
          {text("location", "Where", { placeholder: "Optional", autoCapitalize: "words" })}
          {area("notes", "Notes", { placeholder: "Optional", rows: 3 })}
        </>
      );
    default:
      return null;
  }
}

function CreateScreen({ active }) {
  const [type, setType] = useState("text");
  const [forms, setForms] = useState(EMPTY_FORMS);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [customColors, setCustomColors] = useState(false);
  const [exportSize, setExportSize] = useState(1024);
  const logoRef = useRef(null);
  const savedRef = useRef("");

  const setField = (key, value) =>
    setForms((all) => ({ ...all, [type]: { ...all[type], [key]: value } }));
  const patchStyle = (patch) => setStyle((s) => ({ ...s, ...patch }));

  const payload = useMemo(() => buildPayload(type, forms[type]), [type, forms]);
  const deferredPayload = useDeferredValue(payload);

  // A logo covers part of the code, so it needs the strongest error correction.
  const ec = style.logo ? "H" : style.ec;
  const code = useMemo(() => {
    if (!deferredPayload) return { svg: null, error: null, matrix: null };
    try {
      const matrix = makeMatrix(deferredPayload, ec);
      return { matrix, svg: renderSvg(matrix, style, 1024), error: null };
    } catch {
      return { svg: null, matrix: null, error: "That is too much content for one QR code. Shorten it or lower the error correction." };
    }
  }, [deferredPayload, style, ec]);

  const contrast = contrastRatio(style.fg, style.bg);
  const inverted = contrastRatio(style.fg, "#000000") > contrastRatio(style.bg, "#000000");
  const activePreset = customColors
    ? null
    : COLOR_PRESETS.find((p) => p.fg === style.fg && p.bg === style.bg)?.id;

  /** Runs an export action and records the code under "Created" the first time. */
  const withHistory = (action) => async () => {
    if (!code.svg) return;
    if (getSettings().saveHistory && savedRef.current !== payload) {
      addHistory({ kind: "create", text: payload, format: "qr_code" });
      savedRef.current = payload;
    }
    await action(code.svg, exportSize);
  };

  const pickLogo = async (file) => {
    if (!file) return;
    try {
      patchStyle({ logo: await readLogo(file) });
    } catch {
      toast("Could not read that image", { tone: "error" });
    }
  };

  const ready = !!code.svg;

  return (
    <section className={`screen ${active ? "is-active" : ""}`} aria-label="Create" aria-hidden={!active}>
      <div className="page">
        <header className="page-head rise" style={{ "--i": 0 }}>
          <div>
            <div className="eyebrow">New code</div>
            <h1 className="page-title display">
              Create<span className="dot" />
            </h1>
          </div>
        </header>

        <div className="chip-row rise" style={{ "--i": 1 }} role="tablist" aria-label="Code type">
          {CREATE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === type}
              className={`chip ${t.id === type ? "is-active" : ""}`}
              onClick={() => setType(t.id)}
            >
              <Icon name={t.icon} size={17} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="create-grid">
          <div className="create-form card card-pad rise" style={{ "--i": 2 }}>
            <div key={type} className="form-swap">
              <TypeForm type={type} form={forms[type]} set={setField} />
            </div>
          </div>

          <div className="create-preview card rise" style={{ "--i": 3 }}>
            <div className="preview-stage">
              {ready ? (
                <div className="preview-tile" key={type}>
                  <img src={svgDataUrl(code.svg)} alt="Generated QR code" />
                </div>
              ) : (
                <div className="preview-empty">
                  <Glyph />
                  <div className="eyebrow">
                    {code.error ? "Too long" : "Fill in the details to see your code"}
                  </div>
                </div>
              )}
            </div>
            <div className="preview-meta eyebrow">
              <span>{ready ? `${code.matrix.size} × ${code.matrix.size} modules` : "No code yet"}</span>
              <span>{ready ? `${payload.length} chars · EC ${ec}` : "—"}</span>
            </div>
            {code.error && (
              <div style={{ padding: "0 14px 14px" }}>
                <div className="note is-error" style={{ marginTop: 0 }}>
                  <Icon name="alert" size={18} />
                  {code.error}
                </div>
              </div>
            )}
            <div className="preview-actions">
              <button type="button" className="btn btn-primary btn-block" disabled={!ready} onClick={withHistory(saveQrPng)}>
                <Icon name="download" size={19} />
                Save image
              </button>
              <div className="action-grid">
                <button type="button" className="action-tile" disabled={!ready} onClick={withHistory(shareQrPng)}>
                  <Icon name="share" />
                  Share
                </button>
                <button type="button" className="action-tile" disabled={!ready} onClick={withHistory(copyQrPng)}>
                  <Icon name="copy" />
                  Copy
                </button>
                <button type="button" className="action-tile" disabled={!ready} onClick={withHistory(saveQrSvg)}>
                  <Icon name="download" />
                  SVG
                </button>
              </div>
            </div>
          </div>

          <div className="create-style card card-pad rise" style={{ "--i": 4 }}>
            <div className="style-block">
              <span className="eyebrow">Colour</span>
              <div className="swatches">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`swatch ${activePreset === p.id ? "is-active" : ""}`}
                    style={{ "--a": p.fg, "--b": p.bg }}
                    aria-label={`${p.label} colours`}
                    aria-pressed={activePreset === p.id}
                    onClick={() => {
                      setCustomColors(false);
                      patchStyle({ fg: p.fg, bg: p.bg });
                    }}
                  />
                ))}
                <button
                  type="button"
                  className={`swatch swatch-custom ${customColors ? "is-active" : ""}`}
                  aria-label="Custom colours"
                  aria-pressed={customColors}
                  onClick={() => setCustomColors(true)}
                >
                  <Icon name="plus" size={20} />
                </button>
              </div>
              {customColors && (
                <div className="color-pair">
                  <label className="color-field">
                    <input type="color" value={style.fg} onChange={(e) => patchStyle({ fg: e.target.value })} />
                    <span className="eyebrow">Code</span>
                  </label>
                  <label className="color-field">
                    <input type="color" value={style.bg} onChange={(e) => patchStyle({ bg: e.target.value })} />
                    <span className="eyebrow">Background</span>
                  </label>
                </div>
              )}
              {contrast < 3 ? (
                <div className="note is-error">
                  <Icon name="alert" size={18} />
                  These colours are too close together. Most scanners will not read this code.
                </div>
              ) : (
                inverted && (
                  <div className="note">
                    <Icon name="alert" size={18} />
                    Light-on-dark codes look great but some older scanners cannot read them.
                  </div>
                )
              )}
            </div>

            <div className="style-block">
              <span className="eyebrow">Pattern</span>
              <Segmented label="Pattern" options={DOT_OPTIONS} value={style.dot} onChange={(v) => patchStyle({ dot: v })} />
            </div>

            <div className="style-block">
              <span className="eyebrow">Corners</span>
              <Segmented label="Corners" options={EYE_OPTIONS} value={style.eye} onChange={(v) => patchStyle({ eye: v })} />
            </div>

            <div className="style-block">
              <span className="eyebrow">Error correction{style.logo ? " · locked to max with a logo" : ""}</span>
              <Segmented label="Error correction" options={EC_OPTIONS} value={ec} onChange={(v) => patchStyle({ ec: v })} />
            </div>

            <div className="style-block">
              <span className="eyebrow">Centre logo</span>
              <div className="logo-row">
                {style.logo && <div className="logo-thumb" style={{ backgroundImage: `url(${style.logo})` }} />}
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => logoRef.current?.click()}>
                  <Icon name="image" size={18} />
                  {style.logo ? "Replace" : "Add logo"}
                </button>
                {style.logo && (
                  <button type="button" className="icon-btn" aria-label="Remove logo" onClick={() => patchStyle({ logo: null })}>
                    <Icon name="trash" size={20} />
                  </button>
                )}
              </div>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  pickLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="style-block">
              <span className="eyebrow">Export size · pixels</span>
              <Segmented label="Export size" options={SIZE_OPTIONS} value={exportSize} onChange={setExportSize} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(CreateScreen);
