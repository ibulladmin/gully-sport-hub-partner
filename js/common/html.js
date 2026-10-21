// web-common v1.1.0 (ibull-functions 771de24). DO NOT EDIT HERE —
// change ibull-functions/web-common, tag a release, then re-run tools/vendor.mjs.
// ===================== web-common — HTML and URL safety =====================
// Shared by all IBULL sites. Anything a user typed goes through esc() before it
// reaches innerHTML; colours and image URLs that end up in style/src attributes
// are validated, never "cleaned".

/** Escape untrusted text for innerHTML and attribute values. */
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * "#abc" / "#aabbcc", or the fallback. Values land in style attributes, so
 * `red;background:url(https://evil/x)` must never get through.
 */
export function safeHexColor(input, fallback) {
  return typeof input === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input.trim())
    ? input.trim()
    : fallback;
}

/** An https:// URL, or "". Rejects javascript:, data: and plain http:. */
export function safeImageUrl(input) {
  if (typeof input !== "string" || !input.trim()) return "";
  const url = input.trim();
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}
