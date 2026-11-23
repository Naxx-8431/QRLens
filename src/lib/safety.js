/*
 * On-device link check. Nothing leaves the phone: these are structural
 * heuristics that catch the common tricks used in QR phishing, not a
 * reputation lookup. The UI says so.
 */

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly",
  "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "t.ly", "qr.link", "qrco.de", "l.ead.me",
  "s.id", "v.gd", "lnkd.in", "soo.gd", "bl.ink", "short.io", "me-qr.com", "qr.io",
]);

const RISKY_TLDS = new Set([
  "zip", "mov", "tk", "ml", "ga", "cf", "gq", "top", "click", "country", "kim", "work",
  "rest", "cam", "quest",
]);

const DOWNLOAD_EXT = /\.(apk|exe|msi|dmg|pkg|bat|cmd|scr|jar|ps1|vbs|ipa|appx)$/i;

/** Best-effort registrable domain: last two labels, or three for `co.uk`-style suffixes. */
export function registrableDomain(host) {
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const secondLevel = labels[labels.length - 2];
  const tld = labels[labels.length - 1];
  const compound = tld.length === 2 && ["co", "com", "org", "net", "gov", "ac", "edu"].includes(secondLevel);
  return labels.slice(compound ? -3 : -2).join(".");
}

export function checkLink(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { level: "warn", host: url, domain: url, notes: ["This link is malformed."] };
  }

  const host = u.hostname.toLowerCase();
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  const domain = isIp ? host : registrableDomain(host.replace(/^www\./, ""));
  const tld = host.split(".").pop();
  const warn = [];
  const caution = [];

  if (u.username || u.password) warn.push("Uses “@” to disguise where it really goes.");
  if (isIp) {
    warn.push("Points to a raw IP address instead of a named site.");
  }
  if (host.split(".").some((l) => l.startsWith("xn--"))) {
    warn.push("Contains look-alike characters that can imitate another site.");
  }
  if (DOWNLOAD_EXT.test(u.pathname)) warn.push("Downloads an installable file.");

  if (u.protocol === "http:") caution.push("Not encrypted (HTTP).");
  if (SHORTENERS.has(host.replace(/^www\./, ""))) {
    caution.push("Shortened link — the real destination is hidden.");
  }
  if (RISKY_TLDS.has(tld)) caution.push(`Uses a “.${tld}” address, often seen in spam.`);
  if (host.split(".").length > 4) caution.push("Unusually long chain of sub-domains.");
  if (u.port && !["80", "443"].includes(u.port)) caution.push(`Uses a non-standard port (${u.port}).`);
  if (url.length > 300) caution.push("Very long address.");

  const level = warn.length ? "warn" : caution.length ? "caution" : "ok";
  return { level, host, domain, notes: [...warn, ...caution] };
}
