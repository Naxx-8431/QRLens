const DAY = 86400000;

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "Today", "Yesterday", or a date — used to group the history list. */
export function dayLabel(ts, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(ts);
}

export function clockTime(ts) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(ts);
}

/** "Just now", "12 min ago", otherwise day + time. */
export function timeAgo(ts, now = Date.now()) {
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  return `${dayLabel(ts, now)}, ${clockTime(ts)}`;
}
