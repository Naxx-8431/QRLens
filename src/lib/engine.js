/*
 * The barcode engines, shared by the decoder worker and the main-thread fallback.
 *
 * Uses the platform's BarcodeDetector when it exists (fast, hardware backed on
 * Android) and falls back to ZXing compiled to WebAssembly everywhere else. The
 * .wasm file is bundled with the app, so scanning works offline.
 */

const WANTED_FORMATS = [
  "qr_code",
  "aztec",
  "data_matrix",
  "pdf417",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "itf",
];

let nativePromise = null;
let wasmPromise = null;
let nativeBroken = false;
let nativeFailures = 0;

async function loadNative() {
  if (!("BarcodeDetector" in globalThis)) return null;
  try {
    const supported = await globalThis.BarcodeDetector.getSupportedFormats();
    if (!supported.includes("qr_code")) return null;
    return new globalThis.BarcodeDetector({
      formats: WANTED_FORMATS.filter((f) => supported.includes(f)),
    });
  } catch {
    return null;
  }
}

async function loadWasm() {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: WANTED_FORMATS });
}

const getNative = () => (nativePromise ??= loadNative());
const getWasm = () => (wasmPromise ??= loadWasm());

/** Start loading an engine early so the first frame is not delayed. */
export function warmEngine() {
  getNative().then((d) => {
    if (!d) getWasm().catch(() => {});
  });
}

const normalise = (codes) =>
  codes
    .filter((c) => c.rawValue)
    .map((c) => ({
      text: c.rawValue,
      format: c.format,
      points: (c.cornerPoints || []).map((p) => ({ x: p.x, y: p.y })),
    }));

/** Detects codes in an image source (video, canvas, ImageBitmap, ImageData or Blob). */
export async function detectSource(source) {
  const native = nativeBroken ? null : await getNative();
  if (native) {
    try {
      const codes = await native.detect(source);
      nativeFailures = 0;
      return normalise(codes);
    } catch (err) {
      // A frame that is not ready yet is not an engine failure.
      if (err?.name === "InvalidStateError") return [];
      // Some devices expose the API but cannot actually run it.
      if (++nativeFailures >= 3) nativeBroken = true;
    }
  }
  const wasm = await getWasm();
  return normalise(await wasm.detect(source));
}

/** Like detectSource, but asks ZXing for a second opinion when the native engine finds nothing. */
export async function detectThorough(source) {
  let found = await detectSource(source);
  if (!found.length && !nativeBroken && (await getNative())) {
    // ZXing copes better with photos of screens and odd angles.
    const wasm = await getWasm();
    found = normalise(await wasm.detect(source));
  }
  return found;
}
