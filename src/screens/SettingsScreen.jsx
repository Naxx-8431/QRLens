import { useState } from "react";
import Icon from "../components/Icon";
import Sheet from "../components/Sheet";
import { Segmented, SettingRow } from "../components/controls";
import {
  clearHistory,
  historyToCsv,
  SEARCH_ENGINES,
  setSetting,
  toast,
  useHistory,
  useSettings,
} from "../lib/store";
import { saveFile } from "../lib/actions";
import { isNative, timestampName } from "../lib/platform";
import markUrl from "../../assets/mark.svg";

const ENGINE_OPTIONS = Object.entries(SEARCH_ENGINES).map(([value, e]) => ({ value, label: e.label }));

export default function SettingsScreen({ active }) {
  const settings = useSettings();
  const history = useHistory();
  const [confirming, setConfirming] = useState(false);

  const scans = history.filter((i) => i.kind === "scan").length;
  const created = history.length - scans;
  const starred = history.filter((i) => i.fav).length;

  const exportCsv = () => {
    if (!history.length) {
      toast("History is empty");
      return;
    }
    // BOM so spreadsheet apps read non-Latin text correctly.
    const blob = new Blob(["﻿", historyToCsv(history)], { type: "text/csv;charset=utf-8" });
    saveFile(blob, timestampName("QRLens_history", "csv"));
  };

  return (
    <section className={`screen ${active ? "is-active" : ""}`} aria-label="Settings" aria-hidden={!active}>
      <div className="page">
        <header className="page-head rise" style={{ "--i": 0 }}>
          <div>
            <div className="eyebrow">Preferences</div>
            <h1 className="page-title display">
              Settings<span className="dot" />
            </h1>
          </div>
        </header>

        <div className="stat-grid rise" style={{ "--i": 1 }}>
          <div className="card stat">
            <b>{String(scans).padStart(2, "0")}</b>
            <span className="eyebrow">Scanned</span>
          </div>
          <div className="card stat">
            <b>{String(created).padStart(2, "0")}</b>
            <span className="eyebrow">Created</span>
          </div>
          <div className="card stat">
            <b>{String(starred).padStart(2, "0")}</b>
            <span className="eyebrow">Starred</span>
          </div>
        </div>

        <div className="settings-cols">
          <div>
            <div className="section-label eyebrow rise" style={{ "--i": 2 }}>
              Scanning
            </div>
            <div className="card rise" style={{ "--i": 2 }}>
              <SettingRow
                title="Vibrate on scan"
                hint="A short tap when a code is read."
                checked={settings.vibrate}
                onChange={(v) => setSetting("vibrate", v)}
              />
              <SettingRow
                title="Beep on scan"
                checked={settings.beep}
                onChange={(v) => setSetting("beep", v)}
              />
              <SettingRow
                title="Batch mode"
                hint="Keep scanning without stopping at each result."
                checked={settings.batch}
                onChange={(v) => setSetting("batch", v)}
              />
              <SettingRow
                title="Open camera on launch"
                hint={isNative ? "Start scanning as soon as the app opens." : "Your browser will ask for camera access right away."}
                checked={settings.autoStart}
                onChange={(v) => setSetting("autoStart", v)}
              />
            </div>

            <div className="section-label eyebrow rise" style={{ "--i": 3 }}>
              Results
            </div>
            <div className="card rise" style={{ "--i": 3 }}>
              <SettingRow
                title="Copy automatically"
                hint="Put every scan on the clipboard."
                checked={settings.autoCopy}
                onChange={(v) => setSetting("autoCopy", v)}
              />
              <SettingRow
                title="Open links automatically"
                hint="Only links that pass the on-device link check."
                checked={settings.autoOpen}
                onChange={(v) => setSetting("autoOpen", v)}
              />
            </div>
          </div>

          <div>
            <div className="section-label eyebrow rise" style={{ "--i": 4 }}>
              Web search
            </div>
            <div className="card card-pad rise" style={{ "--i": 4 }}>
              <Segmented
                label="Search engine"
                options={ENGINE_OPTIONS}
                value={settings.searchEngine}
                onChange={(v) => setSetting("searchEngine", v)}
              />
              <div className="row-sub" style={{ margin: "10px 4px 0" }}>
                Used for product codes, books and plain text.
              </div>
            </div>

            <div className="section-label eyebrow rise" style={{ "--i": 5 }}>
              History
            </div>
            <div className="card rise" style={{ "--i": 5 }}>
              <SettingRow
                title="Save history"
                hint="Stored only on this device."
                checked={settings.saveHistory}
                onChange={(v) => setSetting("saveHistory", v)}
              />
              <button type="button" className="row row-btn" onClick={exportCsv}>
                <div className="row-body">
                  <div className="row-title">Export as CSV</div>
                  <div className="row-sub">{history.length} entries</div>
                </div>
                <Icon name="download" className="muted" />
              </button>
              <button
                type="button"
                className="row row-btn is-danger"
                disabled={!history.length}
                onClick={() => setConfirming(true)}
                style={{ opacity: history.length ? 1 : 0.4 }}
              >
                <div className="row-body">
                  <div className="row-title">Clear history</div>
                  <div className="row-sub">Removes every entry, including starred ones.</div>
                </div>
                <Icon name="trash" className="muted" />
              </button>
            </div>

            <div className="section-label eyebrow rise" style={{ "--i": 6 }}>
              About
            </div>
            <div className="card about rise" style={{ "--i": 6 }}>
              <img className="about-mark" src={markUrl} alt="" />
              <div>
                <div className="wordmark">QR Lens</div>
                <div className="eyebrow" style={{ marginTop: 8 }}>
                  Version {__APP_VERSION__}
                </div>
                <div className="row-sub" style={{ marginTop: 6 }}>
                  Scanning and link checks run on this device. Nothing you scan is uploaded.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        label="Clear history"
        header={
          <div className="sheet-head">
            <div className="eyebrow" style={{ color: "var(--text)" }}>
              Clear history
            </div>
          </div>
        }
      >
        <h2 className="result-title" style={{ marginTop: 4 }}>
          Delete all {history.length} entries?
        </h2>
        <div className="result-sub">This cannot be undone. Starred entries are deleted too.</div>
        <div className="result-actions">
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => {
              clearHistory();
              setConfirming(false);
              toast("History cleared");
            }}
          >
            <Icon name="trash" size={19} />
            Delete everything
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </section>
  );
}
