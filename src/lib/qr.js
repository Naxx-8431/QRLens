import QRCode from "qrcode";

/*
 * QR rendering. The `qrcode` package only gives us the module matrix; the
 * drawing is done here so the dots, eyes, colours and centre logo can be styled.
 */

export const DEFAULT_STYLE = {
  dot: "square", // square | rounded | dots
  eye: "square", // square | rounded | circle
  fg: "#000000",
  bg: "#ffffff",
  ec: "M", // L | M | Q | H
  margin: 2, // quiet zone, in modules
  logo: null, // data URL
};

export const COLOR_PRESETS = [
  { id: "classic", label: "Classic", fg: "#000000", bg: "#ffffff" },
  { id: "ink", label: "Inverse", fg: "#ffffff", bg: "#000000" },
  { id: "signal", label: "Signal", fg: "#d71921", bg: "#ffffff" },
  { id: "paper", label: "Paper", fg: "#1b1b1b", bg: "#eeebe3" },
];

/** Returns `{ size, isDark(row, col) }` or throws if the text does not fit in a QR code. */
export function makeMatrix(text, ec = "M") {
  const qr = QRCode.create(text, { errorCorrectionLevel: ec });
  const { size, data } = qr.modules;
  return {
    size,
    version: qr.version,
    isDark: (r, c) => r >= 0 && c >= 0 && r < size && c < size && data[r * size + c] === 1,
  };
}

const n = (v) => +v.toFixed(3);

function inEye(r, c, size) {
  return (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
}

function eyeMarkup(x, y, shape, fg) {
  if (shape === "circle") {
    return (
      `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="3" fill="none" stroke="${fg}" stroke-width="1"/>` +
      `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.5" fill="${fg}"/>`
    );
  }
  const outer = shape === "rounded" ? 2 : 0;
  const inner = shape === "rounded" ? 0.9 : 0;
  return (
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="${outer}" fill="none" stroke="${fg}" stroke-width="1"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${inner}" fill="${fg}"/>`
  );
}

/**
 * Renders the matrix as a standalone SVG string.
 * `pixelSize` only sets the width/height attributes; the drawing is in module units.
 */
export function renderSvg(matrix, style = DEFAULT_STYLE, pixelSize = 1024) {
  const s = { ...DEFAULT_STYLE, ...style };
  const { size } = matrix;
  const m = Math.max(0, s.margin);
  const total = size + m * 2;

  // Centre cut-out for the logo: ~22% of the code, snapped to whole modules.
  let hole = null;
  if (s.logo) {
    let span = Math.round(size * 0.22);
    if ((size - span) % 2) span += 1;
    const start = (size - span) / 2;
    hole = { start, end: start + span, span };
  }
  const inHole = (r, c) =>
    hole && r >= hole.start && r < hole.end && c >= hole.start && c < hole.end;

  let body = "";
  if (s.dot === "square") {
    // Merge horizontal runs so the path stays small and there are no hairline seams.
    let d = "";
    for (let r = 0; r < size; r++) {
      let run = 0;
      for (let c = 0; c <= size; c++) {
        const on = c < size && matrix.isDark(r, c) && !inEye(r, c, size) && !inHole(r, c);
        if (on) run++;
        else if (run) {
          d += `M${c - run + m} ${r + m}h${run}v1h${-run}z`;
          run = 0;
        }
      }
    }
    body = `<path d="${d}" fill="${s.fg}"/>`;
  } else {
    const parts = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!matrix.isDark(r, c) || inEye(r, c, size) || inHole(r, c)) continue;
        if (s.dot === "dots") {
          parts.push(`<circle cx="${c + m + 0.5}" cy="${r + m + 0.5}" r="0.44"/>`);
        } else {
          parts.push(`<rect x="${n(c + m + 0.06)}" y="${n(r + m + 0.06)}" width="0.88" height="0.88" rx="0.3"/>`);
        }
      }
    }
    body = `<g fill="${s.fg}">${parts.join("")}</g>`;
  }

  const eyes =
    eyeMarkup(m, m, s.eye, s.fg) +
    eyeMarkup(m + size - 7, m, s.eye, s.fg) +
    eyeMarkup(m, m + size - 7, s.eye, s.fg);

  let logo = "";
  if (hole) {
    const pad = 0.6;
    const x = hole.start + m + pad;
    const w = hole.span - pad * 2;
    logo =
      `<image href="${s.logo}" x="${n(x)}" y="${n(x)}" width="${n(w)}" height="${n(w)}" ` +
      `preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">` +
    `<rect width="${total}" height="${total}" fill="${s.bg}"/>` +
    body +
    eyes +
    logo +
    `</svg>`
  );
}

/** Convenience: text → SVG string, or null when it cannot be encoded. */
export function textToSvg(text, style = DEFAULT_STYLE, pixelSize = 1024) {
  if (!text) return null;
  const ec = style.logo ? "H" : style.ec || "M";
  try {
    return renderSvg(makeMatrix(text, ec), style, pixelSize);
  } catch {
    return null;
  }
}

export function svgToBlob(svg) {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

/** Rasterises the SVG to a PNG blob at `pixelSize` × `pixelSize`. */
export function svgToPngBlob(svg, pixelSize = 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(svgToBlob(svg));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = pixelSize;
        canvas.height = pixelSize;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not render the image"))),
          "image/png"
        );
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render the image"));
    };
    img.src = url;
  });
}

/** Rough contrast ratio between two hex colours, to warn about unscannable palettes. */
export function contrastRatio(a, b) {
  const lum = (hex) => {
    const v = hex.replace("#", "");
    const full = v.length === 3 ? v.split("").map((ch) => ch + ch).join("") : v;
    const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    const lin = rgb.map((ch) => (ch <= 0.03928 ? ch / 12.92 : ((ch + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
