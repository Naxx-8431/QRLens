import { Capacitor, registerPlugin } from "@capacitor/core";

/*
 * Everything that behaves differently in the Android app and in a browser
 * lives here, so the screens never have to ask which one they are running in.
 */

export const isNative = Capacitor.isNativePlatform();

/* ---------- feedback ---------- */

export function vibrate(pattern = 18) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

let audioCtx = null;

export function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1320, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  } catch {
    /* audio not available */
  }
}

/* ---------- clipboard ---------- */

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function copyImage(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/* ---------- files ---------- */

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadInBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function writeNative(blob, filename, directoryName) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const result = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory[directoryName],
  });
  return result.uri;
}

/**
 * Saves a file. Returns a short message describing where it went.
 * On Android it lands in Documents; in a browser it is a normal download.
 */
export async function saveBlob(blob, filename) {
  if (!isNative) {
    downloadInBrowser(blob, filename);
    return "Downloaded";
  }
  try {
    await writeNative(blob, filename, "Documents");
    return "Saved to Documents";
  } catch {
    // Storage can be refused on some devices; the share sheet still lets the user keep the file.
    await shareBlob(blob, filename, "QR Lens");
    return "Opened share sheet";
  }
}

/** Native helper (android/.../PicturesPlugin.java) that writes into Pictures/QRLens. */
const Pictures = registerPlugin("Pictures");

/**
 * Saves an image. On Android it goes to Pictures/QRLens, so it shows up in the
 * Gallery; in a browser it is a normal download. Returns where it went.
 */
export async function saveImage(blob, filename) {
  if (!isNative) {
    downloadInBrowser(blob, filename);
    return "Downloaded";
  }
  try {
    await Pictures.save({
      data: await blobToBase64(blob),
      filename,
      mimeType: (blob.type || "image/png").split(";")[0],
    });
    return "Saved to Pictures/QRLens";
  } catch {
    // Storage refused (or permission denied on old Android): fall back to Documents / share.
    return saveBlob(blob, filename);
  }
}

/** Shares a file through the system share sheet. Returns false if sharing is unavailable. */
export async function shareBlob(blob, filename, title = "QR Lens") {
  if (isNative) {
    const uri = await writeNative(blob, filename, "Cache");
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, files: [uri] });
    return true;
  }
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return true;
  }
  return false;
}

export async function shareText(text, title = "QR Lens") {
  if (isNative) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text });
    return true;
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return true;
  }
  return false;
}

/** A user backing out of the share sheet is not an error worth reporting. */
export const isShareCancel = (err) =>
  err?.name === "AbortError" || /cancel/i.test(String(err?.message || ""));

/* ---------- navigation ---------- */

export function openExternal(url) {
  if (isNative) {
    // Capacitor intercepts anything that is not the app itself and hands it to
    // Android (browser, dialler, mail, maps, UPI apps…).
    window.open(url, "_blank");
  } else if (/^https?:/i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    // tel:, mailto:, sms:, upi:… go straight to the OS without leaving a blank tab behind.
    window.location.href = url;
  }
}

/* ---------- camera permission ---------- */

export async function ensureCameraPermission() {
  if (!isNative) return true; // the browser prompts on getUserMedia
  try {
    const { Camera } = await import("@capacitor/camera");
    const status = await Camera.requestPermissions({ permissions: ["camera"] });
    return status.camera === "granted" || status.camera === "limited";
  } catch {
    return true; // let getUserMedia be the judge
  }
}

export const timestampName = (prefix, ext) => {
  const d = new Date();
  const p = (v) => String(v).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
};
