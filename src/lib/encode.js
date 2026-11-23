/* Builds the payload string for each kind of code the Create screen can make. */

const esc = (s) => String(s ?? "").replace(/([\\;,:"])/g, "\\$1");
const icsText = (s) =>
  String(s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([;,])/g, "\\$1");

const pad = (n) => String(n).padStart(2, "0");

function icsUtc(localValue) {
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

export const CREATE_TYPES = [
  { id: "text", label: "Text", icon: "text" },
  { id: "url", label: "Link", icon: "link" },
  { id: "wifi", label: "Wi-Fi", icon: "wifi" },
  { id: "contact", label: "Contact", icon: "user" },
  { id: "email", label: "Email", icon: "mail" },
  { id: "sms", label: "Message", icon: "message" },
  { id: "phone", label: "Phone", icon: "phone" },
  { id: "geo", label: "Location", icon: "pin" },
  { id: "event", label: "Event", icon: "calendar" },
];

export const EMPTY_FORMS = {
  text: { text: "" },
  url: { url: "" },
  wifi: { ssid: "", password: "", security: "WPA", hidden: false },
  contact: { first: "", last: "", phone: "", email: "", org: "", title: "", url: "", address: "" },
  email: { to: "", subject: "", body: "" },
  sms: { number: "", body: "" },
  phone: { number: "" },
  geo: { lat: "", lng: "" },
  event: { title: "", start: "", end: "", location: "", notes: "" },
};

/** Returns the string to encode, or "" when the form is not filled in enough. */
export function buildPayload(type, f) {
  switch (type) {
    case "text":
      return f.text.trim() ? f.text : "";

    case "url": {
      const v = f.url.trim();
      if (!v) return "";
      return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    }

    case "wifi": {
      if (!f.ssid.trim()) return "";
      const open = f.security === "nopass";
      return (
        `WIFI:T:${f.security};S:${esc(f.ssid)};` +
        (open ? "" : `P:${esc(f.password)};`) +
        (f.hidden ? "H:true;" : "") +
        ";"
      );
    }

    case "contact": {
      const name = [f.first, f.last].map((s) => s.trim()).filter(Boolean).join(" ");
      if (!name && !f.phone.trim() && !f.email.trim() && !f.org.trim()) return "";
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${icsText(f.last.trim())};${icsText(f.first.trim())};;;`,
        `FN:${icsText(name || f.org.trim())}`,
      ];
      if (f.org.trim()) lines.push(`ORG:${icsText(f.org.trim())}`);
      if (f.title.trim()) lines.push(`TITLE:${icsText(f.title.trim())}`);
      if (f.phone.trim()) lines.push(`TEL;TYPE=CELL:${f.phone.trim()}`);
      if (f.email.trim()) lines.push(`EMAIL:${f.email.trim()}`);
      if (f.url.trim()) lines.push(`URL:${f.url.trim()}`);
      if (f.address.trim()) lines.push(`ADR:;;${icsText(f.address.trim())};;;;`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }

    case "email": {
      if (!f.to.trim()) return "";
      const q = [];
      if (f.subject.trim()) q.push(`subject=${encodeURIComponent(f.subject)}`);
      if (f.body.trim()) q.push(`body=${encodeURIComponent(f.body)}`);
      return `mailto:${f.to.trim()}${q.length ? `?${q.join("&")}` : ""}`;
    }

    case "sms":
      if (!f.number.trim()) return "";
      return `SMSTO:${f.number.trim()}:${f.body}`;

    case "phone":
      return f.number.trim() ? `tel:${f.number.trim()}` : "";

    case "geo": {
      const lat = Number(f.lat);
      const lng = Number(f.lng);
      if (f.lat === "" || f.lng === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) return "";
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return "";
      return `geo:${lat},${lng}`;
    }

    case "event": {
      const start = icsUtc(f.start);
      if (!f.title.trim() || !start) return "";
      const end = icsUtc(f.end);
      const lines = ["BEGIN:VEVENT", `SUMMARY:${icsText(f.title.trim())}`, `DTSTART:${start}`];
      if (end) lines.push(`DTEND:${end}`);
      if (f.location.trim()) lines.push(`LOCATION:${icsText(f.location.trim())}`);
      if (f.notes.trim()) lines.push(`DESCRIPTION:${icsText(f.notes.trim())}`);
      lines.push("END:VEVENT");
      return lines.join("\n");
    }

    default:
      return "";
  }
}

/** vCard file for the "Save contact" action on a scanned contact. */
export function contactToVcf(c) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${icsText(c.name || c.org || "Contact")}`];
  if (c.name) {
    const parts = c.name.split(" ");
    const last = parts.length > 1 ? parts.pop() : "";
    lines.push(`N:${icsText(last)};${icsText(parts.join(" "))};;;`);
  }
  if (c.org) lines.push(`ORG:${icsText(c.org)}`);
  if (c.title) lines.push(`TITLE:${icsText(c.title)}`);
  for (const p of c.phones || []) lines.push(`TEL;TYPE=CELL:${p}`);
  for (const e of c.emails || []) lines.push(`EMAIL:${e}`);
  if (c.url) lines.push(`URL:${c.url}`);
  if (c.address) lines.push(`ADR:;;${icsText(c.address)};;;;`);
  if (c.note) lines.push(`NOTE:${icsText(c.note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** Calendar file for the "Add to calendar" action on a scanned event. */
export function eventToIcs(ev) {
  const stamp = (ms) => (ms ? icsUtc(ms) : "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QR Lens//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@qrlens`,
    `DTSTAMP:${icsUtc(Date.now())}`,
    `SUMMARY:${icsText(ev.summary)}`,
  ];
  if (ev.start) lines.push(`DTSTART:${stamp(ev.start)}`);
  if (ev.end) lines.push(`DTEND:${stamp(ev.end)}`);
  if (ev.location) lines.push(`LOCATION:${icsText(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${icsText(ev.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
