// web-common v1.1.0 (ibull-functions 771de24). DO NOT EDIT HERE —
// change ibull-functions/web-common, tag a release, then re-run tools/vendor.mjs.
// ===================== web-common — Formatting =====================
// Dates, money and durations, the way people in India read them.

const toDate = (d) => (d && d.toDate ? d.toDate() : d ? new Date(d) : null);

/**
 * Firestore Timestamp / Date / string -> "5 Oct 2026".
 * `empty` is shown for no value; `invalid` for an unparseable one
 * (a function gets the raw value, e.g. to show it as typed).
 */
export function fmtDate(d, { empty = "—", invalid = "—" } = {}) {
  if (!d) return empty;
  const dt = toDate(d);
  if (!dt || isNaN(dt.getTime())) return typeof invalid === "function" ? invalid(d) : invalid;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** 150000 -> "₹1,50,000"; decimals only when there is a fraction ("₹1,234.50"). */
export function inr(n) {
  const v = Number(n) || 0;
  const frac = Math.abs(v % 1) > 0 ? 2 : 0;
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: frac, maximumFractionDigits: 2 });
}

/** "2:14" or "1:02:03" -> seconds, "" -> null, anything else -> NaN. */
export function parseDuration(s) {
  const v = String(s ?? "").trim();
  if (!v) return null;
  const m = v.match(/^(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)$/);
  if (!m) return NaN;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
}

/** 134 -> "2:14", 3723 -> "1:02:03", nothing/0 -> "". */
export function fmtDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = Math.floor(n % 60);
  const pad = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(date, now = Date.now()) {
  const d = toDate(date);
  if (!d || isNaN(d)) return "";
  const s = Math.max(0, (now - d.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
