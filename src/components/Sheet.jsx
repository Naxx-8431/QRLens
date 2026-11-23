import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Back button / Escape handling shared by every open sheet.
 *
 * While at least one sheet is open there is exactly one extra "guard" entry in
 * the browser history. Pressing back (the Android system button, or the
 * browser's) pops that entry and closes the top sheet instead of leaving the
 * app. Closing a sheet any other way removes the guard with history.back();
 * those self-inflicted pops are counted so they are never mistaken for the
 * user's, even if another sheet opens before the pop arrives.
 */
const openSheets = [];
let selfPops = 0;

const hasGuard = () => !!window.history.state?.qrlensSheet;

function ensureGuard() {
  if (openSheets.length && !hasGuard()) window.history.pushState({ qrlensSheet: true }, "");
}

function registerSheet(entry) {
  openSheets.push(entry);
  if (selfPops === 0) ensureGuard();
}

function unregisterSheet(entry) {
  const i = openSheets.indexOf(entry);
  if (i >= 0) openSheets.splice(i, 1);
  if (selfPops > 0) return; // the pending pop will tidy up when it lands
  if (openSheets.length) ensureGuard();
  else if (hasGuard()) {
    selfPops++;
    window.history.back();
  }
}

if (typeof window !== "undefined") {
  // A reload while a sheet was open leaves a stale guard as the current entry.
  if (hasGuard()) window.history.replaceState(null, "");

  window.addEventListener("popstate", () => {
    if (selfPops > 0) {
      selfPops--;
      if (selfPops === 0) ensureGuard();
      return;
    }
    openSheets[openSheets.length - 1]?.close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") openSheets[openSheets.length - 1]?.close();
  });
}

/**
 * Frosted bottom sheet (a centred dialog on wide screens).
 * Drag the header down to dismiss, press Escape, tap the scrim, or use the
 * Android back button — all of them call `onClose`.
 */
export default function Sheet({ open, onClose, label, header, children }) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const sheetRef = useRef(null);
  const dragRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const entry = { close: () => onCloseRef.current() };
    registerSheet(entry);
    return () => unregisterSheet(entry);
  }, [open]);

  useEffect(() => {
    if (open) sheetRef.current?.focus({ preventScroll: true });
  }, [open, mounted]);

  if (!mounted) return null;
  const closing = !open;

  const setDrag = (px) => sheetRef.current?.style.setProperty("--drag", `${px}px`);

  const onPointerDown = (e) => {
    // Buttons in the header must keep receiving their own taps.
    if (e.pointerType === "mouse" || closing || e.target.closest("button")) return;
    dragRef.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
    sheetRef.current?.classList.remove("is-settling");
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    setDrag(Math.max(0, e.clientY - d.startY));
  };

  const onPointerEnd = (e) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    const distance = Math.max(0, e.clientY - d.startY);
    if (distance > 120 || (distance > 30 && d.velocity > 0.6)) {
      onClose(); // the closing animation starts from the dragged position
    } else {
      sheetRef.current?.classList.add("is-settling");
      setDrag(0);
    }
  };

  return createPortal(
    <div className={`sheet-root ${closing ? "is-closing" : ""}`}>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        ref={sheetRef}
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) setMounted(false);
        }}
      >
        <div
          className="sheet-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div className="sheet-handle" />
          {header}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    // Rendered at the app root so it sits above every screen but below toasts.
    document.getElementById("overlays") || document.body
  );
}
