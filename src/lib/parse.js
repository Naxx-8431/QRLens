/* Turns the raw text of a scanned code into something a person can act on. */

const PRODUCT_FORMATS = new Set(["ean_13", "ean_8", "upc_a", "upc_e"]);

const COMMON_TLDS = new Set([
  "com", "org", "net", "io", "co", "in", "ae", "app", "dev", "me", "ly", "gov",
  "edu", "info", "uk", "us", "de", "fr", "ai", "tv", "to", "xyz", "shop", "store",
  "page", "link", "site", "online", "tech", "biz", "ca", "au", "sa", "qa",
]);

export const FORMAT_LABELS = {
  qr_code: "QR",
  micro_qr_code: "Micro QR",
  rm_qr_code: "rMQR",
  aztec: "Aztec",
  data_matrix: "Data Matrix",
  pdf417: "PDF417",
  ean_13: "EAN-13",
  ean_8: "EAN-8",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
  code_128: "Code 128",
  code_39: "Code 39",
  code_93: "Code 93",
  codabar: "Codabar",
  itf: "ITF",
};

export const TYPE_META = {
  url: { label: "Link", icon: "link" },
  wifi: { label: "Wi-Fi", icon: "wifi" },
  contact: { label: "Contact", icon: "user" },
  email: { label: "Email", icon: "mail" },
  sms: { label: "Message", icon: "message" },
  phone: { label: "Phone", icon: "phone" },
  geo: { label: "Location", icon: "pin" },
  event: { label: "Event", icon: "calendar" },
  otp: { label: "2FA key", icon: "key" },
  payment: { label: "Payment", icon: "card" },
  product: { label: "Product", icon: "barcode" },
  book: { label: "Book", icon: "book" },
  text: { label: "Text", icon: "text" },
};

/* ---------- helpers ---------- */

const unescapeValue = (s) => s.replace(/\\([\\;,:"])/g, "$1");

/** Splits `K:v;K:v;` style payloads (Wi-Fi, MECARD, MATMSG) honouring backslash escapes. */
function splitFields(body) {
  const out = {};
  let cur = "";
  const parts = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && i + 1 < body.length) {
      cur += ch + body[++i];
    } else if (ch === ";") {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim().toUpperCase();
    const value = unescapeValue(part.slice(idx + 1));
    if (key in out) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

const first = (v) => (Array.isArray(v) ? v[0] : v) || "";
const list = (v) => (v == null || v === "" ? [] : [].concat(v));

/** Percent-decoding that never throws. "+" is only a space where the format says so. */
function safeDecode(s, plusAsSpace = false) {
  try {
    return decodeURIComponent(plusAsSpace ? s.replace(/\+/g, " ") : s);
  } catch {
    return s;
  }
}

function parseQuery(q, plusAsSpace = true) {
  const out = {};
  if (!q) return out;
  for (const pair of q.split("&")) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    const k = idx < 0 ? pair : pair.slice(0, idx);
    const v = idx < 0 ? "" : pair.slice(idx + 1);
    out[safeDecode(k).toLowerCase()] = safeDecode(v, plusAsSpace);
  }
  return out;
}

/** iCalendar / vCard line unfolding + `NAME;PARAM=x:value` splitting. */
function parseContentLines(text) {
  const unfolded = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
  const lines = [];
  for (const line of unfolded.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const head = line.slice(0, idx);
    const [rawName, ...params] = head.split(";");
    const name = rawName.split(".").pop().toUpperCase();
    lines.push({
      name,
      params: params.join(";").toUpperCase(),
      value: line.slice(idx + 1).trim(),
    });
  }
  return lines;
}

const unescapeText = (s) =>
  s.replace(/\\n/gi, "\n").replace(/\\([\\;,])/g, "$1");

function parseIcsDate(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v || "");
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h == null) return { date: new Date(+y, +mo - 1, +d), allDay: true };
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)))
    : new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0));
  return { date, allDay: false };
}

export function formatWhen(parsed) {
  if (!parsed || Number.isNaN(parsed.date.getTime())) return "";
  const opts = parsed.allDay
    ? { dateStyle: "medium" }
    : { dateStyle: "medium", timeStyle: "short" };
  return new Intl.DateTimeFormat(undefined, opts).format(parsed.date);
}

function looksLikeUrl(text) {
  if (/\s/.test(text)) return null;
  if (/^https?:\/\/[^\s/]+/i.test(text)) return text;
  if (/^www\.[^\s.]+\.[^\s]+$/i.test(text)) return `https://${text}`;
  const m = /^([a-z0-9-]+\.)+([a-z]{2,})(:\d+)?(\/\S*)?$/i.exec(text);
  if (m && COMMON_TLDS.has(m[2].toLowerCase())) return `https://${text}`;
  return null;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

/* ---------- type parsers ---------- */

function parseWifi(text) {
  const f = splitFields(text.slice(5));
  const ssid = first(f.S);
  if (!ssid) return null;
  const rawType = first(f.T).toUpperCase();
  const security = !rawType || rawType === "NOPASS" ? "None" : rawType;
  const password = first(f.P);
  const hidden = /^true$/i.test(first(f.H));
  return {
    type: "wifi",
    title: ssid,
    subtitle: security === "None" ? "Open network" : `${security} secured`,
    fields: [
      { label: "Network", value: ssid },
      { label: "Security", value: security },
      ...(password ? [{ label: "Password", value: password, secret: true }] : []),
      ...(hidden ? [{ label: "Hidden", value: "Yes" }] : []),
    ],
    data: { ssid, security, password, hidden },
  };
}

function contactResult(c) {
  const name = c.name || c.org || c.phones[0] || c.emails[0] || "Contact";
  return {
    type: "contact",
    title: name,
    subtitle: [c.title, c.org].filter(Boolean).join(" · ") || c.phones[0] || c.emails[0] || "",
    fields: [
      ...(c.name ? [{ label: "Name", value: c.name }] : []),
      ...(c.org ? [{ label: "Company", value: c.org }] : []),
      ...(c.title ? [{ label: "Title", value: c.title }] : []),
      ...c.phones.map((v) => ({ label: "Phone", value: v })),
      ...c.emails.map((v) => ({ label: "Email", value: v })),
      ...(c.url ? [{ label: "Website", value: c.url }] : []),
      ...(c.address ? [{ label: "Address", value: c.address }] : []),
      ...(c.note ? [{ label: "Note", value: c.note }] : []),
    ],
    data: c,
  };
}

function parseVcard(text) {
  const lines = parseContentLines(text);
  const get = (n) => lines.filter((l) => l.name === n).map((l) => unescapeText(l.value));
  const n = get("N")[0];
  const nameFromN = n
    ? n.split(";").slice(0, 2).reverse().map((s) => s.trim()).filter(Boolean).join(" ")
    : "";
  const adr = get("ADR")[0];
  return contactResult({
    name: get("FN")[0] || nameFromN,
    org: (get("ORG")[0] || "").split(";").filter(Boolean).join(", "),
    title: get("TITLE")[0] || "",
    phones: get("TEL").map((v) => v.replace(/^tel:/i, "")),
    emails: get("EMAIL"),
    url: get("URL")[0] || "",
    address: adr ? adr.split(";").map((s) => s.trim()).filter(Boolean).join(", ") : "",
    note: get("NOTE")[0] || "",
  });
}

function parseMecard(text) {
  const f = splitFields(text.slice(7));
  const rawName = first(f.N);
  const name = rawName.includes(",")
    ? rawName.split(",").map((s) => s.trim()).reverse().filter(Boolean).join(" ")
    : rawName;
  return contactResult({
    name,
    org: first(f.ORG),
    title: "",
    phones: list(f.TEL),
    emails: list(f.EMAIL),
    url: first(f.URL),
    address: first(f.ADR).split(",").map((s) => s.trim()).filter(Boolean).join(", "),
    note: first(f.NOTE),
  });
}

function parseEvent(text) {
  const lines = parseContentLines(text);
  let inEvent = false;
  const ev = {};
  for (const l of lines) {
    if (l.name === "BEGIN" && l.value.toUpperCase() === "VEVENT") inEvent = true;
    else if (l.name === "END" && l.value.toUpperCase() === "VEVENT") break;
    else if (inEvent && !(l.name in ev)) ev[l.name] = l.value;
  }
  if (!inEvent) return null;
  const start = parseIcsDate(ev.DTSTART);
  const end = parseIcsDate(ev.DTEND);
  const summary = unescapeText(ev.SUMMARY || "Event");
  const location = unescapeText(ev.LOCATION || "");
  const description = unescapeText(ev.DESCRIPTION || "");
  return {
    type: "event",
    title: summary,
    subtitle: formatWhen(start) || location,
    fields: [
      { label: "Title", value: summary },
      ...(start ? [{ label: "Starts", value: formatWhen(start) }] : []),
      ...(end ? [{ label: "Ends", value: formatWhen(end) }] : []),
      ...(location ? [{ label: "Where", value: location }] : []),
      ...(description ? [{ label: "Details", value: description }] : []),
    ],
    data: {
      summary,
      location,
      description,
      start: start ? start.date.getTime() : null,
      end: end ? end.date.getTime() : null,
      allDay: !!start?.allDay,
    },
  };
}

function emailResult(to, subject, body) {
  return {
    type: "email",
    title: to || "Email",
    subtitle: subject || "",
    fields: [
      ...(to ? [{ label: "To", value: to }] : []),
      ...(subject ? [{ label: "Subject", value: subject }] : []),
      ...(body ? [{ label: "Message", value: body }] : []),
    ],
    data: { to, subject, body },
  };
}

function smsResult(number, body) {
  return {
    type: "sms",
    title: number || "Message",
    subtitle: body || "",
    fields: [
      ...(number ? [{ label: "To", value: number }] : []),
      ...(body ? [{ label: "Message", value: body }] : []),
    ],
    data: { number, body },
  };
}

function parseGeo(text) {
  const [coords, query] = text.slice(4).split("?");
  const [lat, lng] = coords.split(/[,;]/).map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const q = parseQuery(query).q || "";
  const pretty = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return {
    type: "geo",
    title: q || pretty,
    subtitle: q ? pretty : "Coordinates",
    fields: [
      { label: "Latitude", value: String(lat) },
      { label: "Longitude", value: String(lng) },
      ...(q ? [{ label: "Place", value: q }] : []),
    ],
    data: { lat, lng, query: q },
  };
}

function parseOtp(text) {
  const m = /^otpauth:\/\/(totp|hotp)\/([^?]*)\??(.*)$/i.exec(text);
  if (!m) return null;
  const label = safeDecode(m[2]);
  const q = parseQuery(m[3]);
  const [maybeIssuer, maybeAccount] = label.includes(":") ? label.split(/:(.*)/) : ["", label];
  const issuer = q.issuer || maybeIssuer;
  const account = (maybeAccount || "").trim();
  return {
    type: "otp",
    title: issuer || account || "Authenticator key",
    subtitle: issuer ? account : m[1].toUpperCase(),
    fields: [
      ...(issuer ? [{ label: "Issuer", value: issuer }] : []),
      ...(account ? [{ label: "Account", value: account }] : []),
      { label: "Type", value: m[1].toUpperCase() },
      ...(q.secret ? [{ label: "Secret", value: q.secret, secret: true }] : []),
    ],
    data: { issuer, account },
  };
}

function parseUpi(text) {
  const q = parseQuery(text.split("?")[1]);
  if (!q.pa) return null;
  const amount = q.am ? `${q.cu || "INR"} ${q.am}` : "";
  return {
    type: "payment",
    title: q.pn || q.pa,
    subtitle: amount || "UPI payment",
    fields: [
      ...(q.pn ? [{ label: "Payee", value: q.pn }] : []),
      { label: "UPI ID", value: q.pa },
      ...(amount ? [{ label: "Amount", value: amount }] : []),
      ...(q.tn ? [{ label: "Note", value: q.tn }] : []),
    ],
    data: { scheme: "upi" },
  };
}

function parseCrypto(text) {
  const m = /^(bitcoin|ethereum|litecoin|bitcoincash|dogecoin):([^?]+)\??(.*)$/i.exec(text);
  if (!m) return null;
  const coin = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const q = parseQuery(m[3]);
  const amount = q.amount || q.value || "";
  return {
    type: "payment",
    title: `${coin} address`,
    subtitle: amount ? `Amount ${amount}` : m[2],
    fields: [
      { label: "Network", value: coin },
      { label: "Address", value: m[2] },
      ...(amount ? [{ label: "Amount", value: amount }] : []),
      ...(q.label ? [{ label: "Label", value: q.label }] : []),
    ],
    data: { scheme: m[1].toLowerCase() },
  };
}

/* ---------- entry point ---------- */

export function parseContent(rawInput, format = "qr_code") {
  const raw = String(rawInput ?? "");
  const text = raw.trim();
  const upper = text.slice(0, 16).toUpperCase();
  let result = null;

  if (upper.startsWith("WIFI:")) result = parseWifi(text);
  else if (upper.startsWith("BEGIN:VCARD")) result = parseVcard(text);
  else if (upper.startsWith("MECARD:")) result = parseMecard(text);
  else if (upper.startsWith("BEGIN:VEVENT") || upper.startsWith("BEGIN:VCALENDAR")) {
    result = parseEvent(text);
  } else if (upper.startsWith("MAILTO:")) {
    const [to, query] = text.slice(7).split("?");
    // In mailto links a "+" is a literal plus (think name+tag@example.com).
    const q = parseQuery(query, false);
    result = emailResult(safeDecode(to), q.subject || "", q.body || "");
  } else if (upper.startsWith("MATMSG:")) {
    const f = splitFields(text.slice(7));
    result = emailResult(first(f.TO), first(f.SUB), first(f.BODY));
  } else if (/^(sms|smsto|mms|mmsto):/i.test(text)) {
    const scheme = text.slice(0, text.indexOf(":")).toLowerCase();
    const rest = text.slice(scheme.length + 1);
    const query = /^[^:?]*\?(.*)$/s.exec(rest);
    if (!scheme.endsWith("to") && query) {
      // sms:+15550100?body=Hello
      result = smsResult(safeDecode(rest.slice(0, rest.indexOf("?"))), parseQuery(query[1]).body || "");
    } else {
      // SMSTO:+15550100:Hello — everything after the first colon is the message.
      const idx = rest.indexOf(":");
      result = idx < 0 ? smsResult(rest, "") : smsResult(rest.slice(0, idx), rest.slice(idx + 1));
    }
  } else if (upper.startsWith("TEL:")) {
    const number = text.slice(4).trim();
    result = {
      type: "phone",
      title: number,
      subtitle: "Phone number",
      fields: [{ label: "Number", value: number }],
      data: { number },
    };
  } else if (upper.startsWith("GEO:")) result = parseGeo(text);
  else if (upper.startsWith("OTPAUTH://")) result = parseOtp(text);
  else if (upper.startsWith("UPI://")) result = parseUpi(text);
  else if (/^(bitcoin|ethereum|litecoin|bitcoincash|dogecoin):/i.test(text)) {
    result = parseCrypto(text);
  }

  if (!result) {
    const url = looksLikeUrl(text);
    if (url) {
      result = {
        type: "url",
        title: hostOf(url),
        subtitle: url,
        fields: [{ label: "Address", value: url }],
        data: { url },
      };
    }
  }

  if (!result && PRODUCT_FORMATS.has(format) && /^\d{6,14}$/.test(text)) {
    const isBook = format === "ean_13" && /^97[89]/.test(text);
    result = {
      type: isBook ? "book" : "product",
      title: text,
      subtitle: isBook ? "ISBN" : "Product code",
      fields: [{ label: isBook ? "ISBN" : "Code", value: text }],
      data: { code: text },
    };
  }

  if (!result) {
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
    result = {
      type: "text",
      title: firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine || "Empty code",
      subtitle: `${text.length} character${text.length === 1 ? "" : "s"}`,
      fields: [],
      data: {},
    };
  }

  return {
    ...result,
    raw,
    format,
    formatLabel: FORMAT_LABELS[format] || format.replace(/_/g, " ").toUpperCase(),
    ...TYPE_META[result.type],
  };
}
