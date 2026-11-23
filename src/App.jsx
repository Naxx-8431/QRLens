import { useCallback, useEffect, useRef, useState } from "react";
import { NavBar, Toasts } from "./components/controls";
import ResultSheet from "./components/ResultSheet";
import ScanScreen from "./screens/ScanScreen";
import CreateScreen from "./screens/CreateScreen";
import HistoryScreen from "./screens/HistoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { parseContent } from "./lib/parse";
import { checkLink } from "./lib/safety";
import { beep, copyText, openExternal, vibrate } from "./lib/platform";
import { addHistory, getSettings, toast } from "./lib/store";

const TEXT_ENTRY = 'textarea, input:not([type="range"], [type="color"], [type="file"], [type="checkbox"])';

/**
 * Marks the element with `data-keyboard` while the on-screen keyboard is up, so the
 * nav can step aside. A focused field alone is not enough (focus often stays after the
 * keyboard is dismissed), so this also requires the visible area to have shrunk.
 */
function useKeyboardFlag(ref) {
  useEffect(() => {
    const vv = window.visualViewport;
    const height = () => (vv ? vv.height : window.innerHeight);
    let base = { width: window.innerWidth, height: height() };

    const update = () => {
      const h = height();
      if (window.innerWidth !== base.width) base = { width: window.innerWidth, height: h };
      else if (h > base.height) base.height = h;
      const typing = !!document.activeElement?.matches?.(TEXT_ENTRY);
      ref.current?.toggleAttribute("data-keyboard", typing && base.height - h > 140);
    };

    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [ref]);
}

export default function App() {
  const [tab, setTab] = useState("scan");
  const [result, setResult] = useState(null);
  const appRef = useRef(null);
  useKeyboardFlag(appRef);

  /** Every successful decode — camera, picked image, drop or paste — lands here. */
  const handleDetected = useCallback((text, format, { silent = false } = {}) => {
    const s = getSettings();
    if (s.vibrate) vibrate(22);
    if (s.beep) beep();

    const entry = s.saveHistory
      ? addHistory({ kind: "scan", text, format })
      : { id: null, kind: "scan", text, format, ts: Date.now() };

    if (s.autoCopy) {
      copyText(text).then((ok) => ok && !silent && toast("Copied to clipboard"));
    }
    if (silent) return;

    setResult(entry);

    if (s.autoOpen) {
      const parsed = parseContent(text, format);
      if (parsed.type === "url" && checkLink(parsed.data.url).level === "ok") {
        openExternal(parsed.data.url);
      }
    }
  }, []);

  const closeResult = useCallback(() => setResult(null), []);
  const openHistory = useCallback(() => setTab("history"), []);

  return (
    <div className="app" ref={appRef}>
      <ScanScreen
        active={tab === "scan"}
        paused={!!result}
        onDetected={handleDetected}
        onOpenHistory={openHistory}
      />
      <CreateScreen active={tab === "create"} />
      <HistoryScreen active={tab === "history"} onOpen={setResult} />
      <SettingsScreen active={tab === "settings"} />

      <NavBar tab={tab} onChange={setTab} />
      <div id="overlays" />
      <ResultSheet entry={result} onClose={closeResult} />
      <Toasts />
    </div>
  );
}
