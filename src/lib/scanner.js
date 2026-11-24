/*
 * Barcode detection front end.
 *
 * Frames are grabbed as ImageBitmaps (scaled down: a QR code does not need 1080p)
 * and decoded in a Web Worker, so the camera never blocks the interface. Where
 * workers or ImageBitmaps are unavailable, decoding falls back to the main thread.
 */
import { detectSource, detectThorough, warmEngine } from "./engine";

/** Longest side of a frame handed to the decoder. */
const MAX_SIDE = 1280;

let worker = null;
let workerBroken = typeof Worker === "undefined" || typeof createImageBitmap === "undefined";
let seq = 0;
const pending = new Map();

function failWorker() {
  workerBroken = true;
  pending.forEach((p) => p.reject(new Error("decoder worker failed")));
  pending.clear();
  worker?.terminate();
  worker = null;
}

function getWorker() {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./scanner.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { id, codes, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(codes);
    };
    worker.onerror = failWorker;
  } catch {
    failWorker();
  }
  return worker;
}

function inWorker(bitmap, thorough) {
  const w = getWorker();
  if (!w) {
    bitmap.close?.();
    return Promise.reject(new Error("no worker"));
  }
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    w.postMessage({ id, bitmap, thorough }, [bitmap]);
  });
}

/** Start loading the engine early so the first frame is not delayed. */
export function warmUp() {
  const w = getWorker();
  if (w) w.postMessage({ warm: true });
  else warmEngine();
}

/** Detects codes in a playing video. Corner points are in video pixels. */
export async function detect(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return [];

  if (!workerBroken) {
    const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh));
    let bitmap;
    try {
      bitmap = await createImageBitmap(
        video,
        scale < 1
          ? { resizeWidth: Math.round(vw * scale), resizeHeight: Math.round(vh * scale), resizeQuality: "medium" }
          : undefined
      );
    } catch {
      return [];
    }
    try {
      const codes = await inWorker(bitmap, false);
      if (scale === 1) return codes;
      return codes.map((c) => ({ ...c, points: c.points.map((p) => ({ x: p.x / scale, y: p.y / scale })) }));
    } catch {
      if (!workerBroken) return [];
      // The worker died: carry on without it.
    }
  }
  return detectSource(video);
}

/** Decodes a picked/dropped/pasted image file. Tries harder than the live loop. */
export async function detectInFile(file) {
  const bitmap = await createImageBitmap(file);
  if (!workerBroken) {
    try {
      return await inWorker(bitmap, true);
    } catch {
      if (!workerBroken) throw new Error("Could not read that image");
      // The bitmap went to the dead worker; decode the file here instead.
      const again = await createImageBitmap(file);
      try {
        return await detectThorough(again);
      } finally {
        again.close?.();
      }
    }
  }
  try {
    return await detectThorough(bitmap);
  } finally {
    bitmap.close?.();
  }
}
