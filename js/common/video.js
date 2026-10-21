// web-common v1.1.0 (ibull-functions 771de24). DO NOT EDIT HERE —
// change ibull-functions/web-common, tag a release, then re-run tools/vendor.mjs.
// ===================== web-common — Video links =====================
//
// Turns a pasted link into what a page needs to show it. Only YouTube and Vimeo
// are ever put inside an <iframe>, with the id rebuilt from a strict pattern —
// never the pasted URL itself — because an iframe src taken from user input is
// an XSS / clickjacking vector. Everything else (Instagram, Facebook…) becomes a
// link that opens in a new tab, and only if it's https.

const YT_ID = /^[\w-]{11}$/;

/**
 * @returns {null | {provider:'youtube'|'vimeo'|'link', id?:string, embedUrl?:string,
 *                   thumbUrl?:string|null, watchUrl:string, vertical?:boolean}}
 */
export function parseVideo(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "").toLowerCase();

  // YouTube: watch?v=, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID
  let yt = null, vertical = false;
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    yt = u.searchParams.get("v");
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/);
    if (!yt && m) { yt = m[2]; vertical = m[1] === "shorts"; }
  } else if (host === "youtu.be") {
    yt = u.pathname.slice(1, 12);
  }
  if (yt && YT_ID.test(yt)) {
    return {
      provider: "youtube",
      id: yt,
      vertical,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1`,
      thumbUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${yt}`
    };
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  const vm = host === "vimeo.com" ? u.pathname.match(/^\/(\d{5,12})(?:\/|$)/)
    : host === "player.vimeo.com" ? u.pathname.match(/^\/video\/(\d{5,12})(?:\/|$)/) : null;
  if (vm) {
    return {
      provider: "vimeo",
      id: vm[1],
      embedUrl: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&dnt=1`,
      thumbUrl: null, // needs a lookup; the admin page stores it as thumbUrl
      watchUrl: `https://vimeo.com/${vm[1]}`
    };
  }

  // Anything else: a link out, https only.
  if (u.protocol !== "https:") return null;
  return { provider: "link", watchUrl: u.href, thumbUrl: null };
}
