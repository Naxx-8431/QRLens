import { memo, useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import { Glyph } from "../components/controls";
import { detect, detectInFile, warmUp } from "../lib/scanner";
import { ensureCameraPermission, isNative } from "../lib/platform";
import { parseContent } from "../lib/parse";
import { setSetting, toast, useSettings } from "../lib/store";

/** How long a code must be out of view before it can be scanned again. */
const REARM_MS = 2500;
const FRAME_GAP_MS = 80;
/**
 * After leaving the tab, keep the camera until the screen has faded out. Cutting the
 * stream mid-fade makes Android's WebView flash its placeholder over the video.
 */
const RELEASE_MS = 400;
/** A 1x1 transparent GIF, shown instead of the WebView's default video placeholder. */
const BLANK_POSTER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const IDLE_COPY = {
  idle: {
    title: "Ready",
    body: "Point the camera at any QR code or barcode. Decoding happens on this device.",
  },
  starting: { title: "Waking", body: "Opening the camera…" },
  denied: {
    title: "Blocked",
    body: "Camera access is turned off for QR Lens. Allow it in settings, or scan a saved image instead.",
  },
  nocamera: {
    title: "No lens",
    body: "This device has no camera available. You can still scan a saved image.",
  },
  unsupported: {
    title: "No lens",
    body: "The camera cannot be opened here. It needs a secure (HTTPS) page. You can still scan a saved image.",
  },
  error: {
    title: "Retry",
    body: "The camera could not start. It may be in use by another app.",
  },
};

/** Maps corner points from video pixels to on-screen pixels for an object-fit: cover video. */
function projectPoints(points, video, mirrored) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (!vw || !vh || !cw || !ch || points.length < 3) return null;
  const scale = Math.max(cw / vw, ch / vh);
  const dx = (cw - vw * scale) / 2;
  const dy = (ch - vh * scale) / 2;
  return points
    .map((p) => {
      const x = p.x * scale + dx;
      return `${(mirrored ? cw - x : x).toFixed(1)},${(p.y * scale + dy).toFixed(1)}`;
    })
    .join(" ");
}

function ScanScreen({ active, paused, onDetected, onOpenHistory }) {
  const settings = useSettings();

  const [status, setStatus] = useState("idle");
  const [caps, setCaps] = useState({ torch: false, zoom: null, multi: false });
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mirrored, setMirrored] = useState(false);
  const [outline, setOutline] = useState(null);
  const [batch, setBatch] = useState({ count: 0, last: "" });
  const [dropping, setDropping] = useState(false);
  const [decoding, setDecoding] = useState(false);

  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const sessionRef = useRef(0);
  const facingRef = useRef("environment");
  const mirroredRef = useRef(false);
  const wantLiveRef = useRef(settings.autoStart);
  const seenRef = useRef(new Map());
  const outlineTimerRef = useRef(0);
  const live = useRef({ paused, batch: settings.batch, onDetected });
  const activeRef = useRef(active);
  const releaseTimerRef = useRef(0);

  useEffect(() => {
    // Coming back from a result: whatever is still in view was already handled.
    if (live.current.paused && !paused) {
      const now = performance.now();
      seenRef.current.forEach((_, key) => seenRef.current.set(key, now));
    }
    live.current = { paused, batch: settings.batch, onDetected };
  }, [paused, settings.batch, onDetected]);

  const handleCodes = useCallback((codes, video) => {
    const now = performance.now();
    const seen = seenRef.current;
    for (const [key, t] of seen) if (now - t > REARM_MS) seen.delete(key);

    const fresh = [];
    for (const code of codes) {
      const key = `${code.format}:${code.text}`;
      if (!seen.has(key)) fresh.push(code);
      seen.set(key, now);
    }
    if (!fresh.length) return;

    const isBatch = live.current.batch;
    const accepted = isBatch ? fresh : fresh.slice(0, 1);

    const points = projectPoints(accepted[0].points, video, mirroredRef.current);
    setOutline({ points, id: now });
    clearTimeout(outlineTimerRef.current);
    outlineTimerRef.current = setTimeout(() => setOutline(null), 900);

    if (isBatch) {
      setBatch((b) => ({
        count: b.count + accepted.length,
        last: parseContent(accepted[accepted.length - 1].text, accepted[accepted.length - 1].format).title,
      }));
      accepted.forEach((c) => live.current.onDetected(c.text, c.format, { silent: true }));
    } else {
      // Hold the loop here; the parent releases it when the result is dismissed.
      live.current.paused = true;
      live.current.onDetected(accepted[0].text, accepted[0].format, {});
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorch(false);
    setOutline(null);
    setStatus((s) => (s === "live" || s === "starting" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    const session = ++sessionRef.current;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("starting");
    setTorch(false);
    warmUp();

    if (!(await ensureCameraPermission())) {
      if (session === sessionRef.current) setStatus("denied");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingRef.current },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch (err) {
      if (session !== sessionRef.current) return;
      const name = err?.name || "";
      setStatus(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "nocamera"
            : "error"
      );
      return;
    }
    // Stopped (or restarted) while the permission prompt was open.
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay is allowed for muted inline video; a rejection here is an interrupted play() */
    }
    if (session !== sessionRef.current) return;

    const track = stream.getVideoTracks()[0];
    const trackCaps = track.getCapabilities?.() || {};
    const trackSettings = track.getSettings?.() || {};
    let multi = false;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      multi = devices.filter((d) => d.kind === "videoinput").length > 1;
    } catch {
      /* cannot list devices: hide the flip button */
    }
    if (session !== sessionRef.current) return;

    const z = trackCaps.zoom;
    setCaps({
      torch: !!trackCaps.torch,
      zoom: z && z.max > z.min ? { min: z.min, max: Math.min(z.max, 8), step: z.step || 0.1 } : null,
      multi,
    });
    setZoom(trackSettings.zoom || z?.min || 1);
    mirroredRef.current = trackSettings.facingMode === "user";
    setMirrored(mirroredRef.current);
    seenRef.current.clear();
    setStatus("live");

    const tick = async () => {
      if (session !== sessionRef.current) return;
      if (!live.current.paused && activeRef.current && !document.hidden && video.readyState >= 2) {
        try {
          const codes = await detect(video);
          if (session !== sessionRef.current) return;
          if (codes.length && !live.current.paused && activeRef.current) handleCodes(codes, video);
        } catch {
          /* a failed frame is not worth interrupting the session for */
        }
      }
      setTimeout(tick, FRAME_GAP_MS);
    };
    tick();
  }, [handleCodes]);

  // The camera only runs while this tab is on screen and the page is visible.
  useEffect(() => {
    activeRef.current = active;
    if (!active) return;
    // Back before the camera was released: it is still running, so keep it.
    clearTimeout(releaseTimerRef.current);
    const resume = () => {
      if (document.hidden) stop();
      else if (wantLiveRef.current && !streamRef.current) start();
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      activeRef.current = false;
      releaseTimerRef.current = setTimeout(stop, RELEASE_MS);
    };
  }, [active, start, stop]);

  useEffect(
    () => () => {
      clearTimeout(outlineTimerRef.current);
      clearTimeout(releaseTimerRef.current);
      stop();
    },
    [stop]
  );

  const toggleCamera = () => {
    if (status === "live" || status === "starting") {
      wantLiveRef.current = false;
      stop();
    } else {
      wantLiveRef.current = true;
      start();
    }
  };

  const flip = () => {
    facingRef.current = facingRef.current === "environment" ? "user" : "environment";
    start();
  };

  const applyTrack = async (constraint) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return false;
    try {
      await track.applyConstraints({ advanced: [constraint] });
      return true;
    } catch {
      return false;
    }
  };

  const toggleTorch = async () => {
    const next = !torch;
    if (await applyTrack({ torch: next })) setTorch(next);
    else toast("Flash is not available", { tone: "error" });
  };

  const changeZoom = (value) => {
    setZoom(value);
    applyTrack({ zoom: value });
  };

  const scanFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That is not an image", { tone: "error" });
      return;
    }
    setDecoding(true);
    try {
      const found = await detectInFile(file);
      if (!found.length) {
        toast("No code found in that image", { tone: "error" });
        return;
      }
      found.slice(1).forEach((c) => live.current.onDetected(c.text, c.format, { silent: true }));
      if (found.length > 1) toast(`${found.length} codes found`);
      live.current.onDetected(found[0].text, found[0].format, {});
    } catch {
      toast("Could not read that image", { tone: "error" });
    } finally {
      setDecoding(false);
    }
  }, []);

  // Paste an image anywhere on the scan tab (desktop).
  useEffect(() => {
    if (!active) return;
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        scanFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active, scanFile]);

  const toggleBatch = () => {
    const next = !settings.batch;
    setSetting("batch", next);
    setBatch({ count: 0, last: "" });
    toast(next ? "Batch mode on" : "Batch mode off");
  };

  const isLive = status === "live";
  const isBusy = status === "starting" || decoding;
  const copy = IDLE_COPY[decoding ? "starting" : status] || IDLE_COPY.idle;

  return (
    <section
      className={`screen scan ${active ? "is-active" : ""} ${isLive ? "is-live" : ""}`}
      aria-label="Scan"
      aria-hidden={!active}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDropping(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        scanFile(e.dataTransfer?.files?.[0]);
      }}
    >
      <video
        ref={videoRef}
        className={`scan-video ${isLive ? "is-live" : ""} ${mirrored ? "is-mirrored" : ""}`}
        poster={BLANK_POSTER}
        playsInline
        muted
        autoPlay
        disablePictureInPicture
      />
      <div className="scan-dots" />
      <div className="scan-shade" />

      {outline?.points && (
        <svg className="scan-outline" aria-hidden="true">
          <polygon key={outline.id} points={outline.points} />
        </svg>
      )}

      <div className="scan-stage">
        {isLive ? (
          <div className={`finder ${outline ? "is-locked" : ""}`}>
            <span className="finder-corner" />
            <span className="finder-corner" />
            <span className="finder-corner" />
            <span className="finder-corner" />
            <span className="finder-sweep" />
            <div className="scan-hint eyebrow">
              {settings.batch ? "Batch · keep scanning" : "Point at a code"}
            </div>
          </div>
        ) : (
          <div className="scan-hero">
            <Glyph busy={isBusy} />
            <h1 className="display">
              {decoding ? "Reading" : copy.title}
              <span className="dot" />
            </h1>
            <p>{decoding ? "Looking for codes in your image…" : copy.body}</p>
            {!isNative && status === "idle" && !decoding && (
              <div className="eyebrow">Or drop / paste an image</div>
            )}
          </div>
        )}
      </div>

      <div className="scan-bottom">
        {isLive && settings.batch && batch.count > 0 && (
          <button type="button" className="batch-pill glass" onClick={onOpenHistory}>
            <span className="batch-count">{String(batch.count).padStart(2, "0")}</span>
            <span className="batch-last">{batch.last}</span>
            <span className="chev">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}

        {isLive && caps.zoom && (
          <label className="zoom-bar glass">
            <span className="sr-only">Zoom</span>
            <input
              type="range"
              min={caps.zoom.min}
              max={caps.zoom.max}
              step={caps.zoom.step}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
            />
            <output>{zoom.toFixed(1)}×</output>
          </label>
        )}

        <div className="scan-dock glass">
          <button
            type="button"
            className="icon-btn"
            aria-label="Scan from an image"
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="image" />
          </button>
          {isLive && caps.torch && (
            <button
              type="button"
              className={`icon-btn ${torch ? "is-on" : ""}`}
              aria-label="Flash"
              aria-pressed={torch}
              onClick={toggleTorch}
            >
              <Icon name="torch" />
            </button>
          )}
          <button
            type="button"
            className={`shutter ${isLive || status === "starting" ? "is-live" : ""}`}
            aria-label={isLive || status === "starting" ? "Stop camera" : "Start camera"}
            onClick={toggleCamera}
          >
            <Icon name={isLive || status === "starting" ? "stop" : "camera"} size={26} filled={isLive || status === "starting"} />
          </button>
          {isLive && caps.multi && (
            <button type="button" className="icon-btn" aria-label="Switch camera" onClick={flip}>
              <Icon name="flip" />
            </button>
          )}
          <button
            type="button"
            className={`icon-btn ${settings.batch ? "is-on" : ""}`}
            aria-label="Batch mode"
            aria-pressed={settings.batch}
            onClick={toggleBatch}
          >
            <Icon name="layers" />
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          scanFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {dropping && (
        <div className="drop-veil">
          <div className="display">Drop to scan</div>
        </div>
      )}
    </section>
  );
}

export default memo(ScanScreen);
