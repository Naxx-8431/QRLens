/*
 * Decodes frames off the main thread, so taps, scrolling and animations stay
 * smooth while the camera is live. Receives an ImageBitmap (transferred), returns codes.
 */
import { detectSource, detectThorough, warmEngine } from "./engine";

self.onmessage = async (e) => {
  const { id, bitmap, thorough, warm } = e.data;
  if (warm) {
    warmEngine();
    return;
  }
  try {
    const codes = await (thorough ? detectThorough(bitmap) : detectSource(bitmap));
    self.postMessage({ id, codes });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  } finally {
    bitmap?.close?.();
  }
};
