// web-common v1.1.0 (ibull-functions 771de24). DO NOT EDIT HERE —
// change ibull-functions/web-common, tag a release, then re-run tools/vendor.mjs.
// ===================== web-common — Share buttons =====================
//
// Link sharing for every public page. share-card.js already makes an IMAGE of a
// result or player for WhatsApp; this shares the PAGE itself, so the person who
// taps it lands on the live tournament or profile.
//
// Any element with a `data-share-bar` attribute becomes a share bar (app.js
// mounts them on every page). What gets shared is read at CLICK time, not at
// mount, because tournament and player pages fill in their title after load:
//   url   el.dataset.shareUrl  || location.href
//   text  document.body.dataset.shareText || el.dataset.shareText
//         || <meta name="description"> || document.title
//
// On phones the native share sheet (navigator.share) comes first — it reaches
// every installed app, including Instagram, which has no web share link.
// No third-party scripts are loaded: each button is a plain link to the
// platform's own share URL, so nothing tracks visitors until they click.

import { esc } from "./html.js";

// A site can rewrite shared URLs, e.g. the GullySport phone app turns its
// in-app address into the public https:// one. Default: share as-is.
let mapUrl = (u) => u;

/** configureShare({ toPublicUrl }) — call once, before any share happens. */
export function configureShare({ toPublicUrl } = {}) {
  if (typeof toPublicUrl === "function") mapUrl = toPublicUrl;
}

const TARGETS = [
  { id: "whatsapp", label: "WhatsApp", href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { id: "facebook", label: "Facebook", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: "x", label: "X", href: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { id: "linkedin", label: "LinkedIn", href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { id: "telegram", label: "Telegram", href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` }
];

function shareData(el) {
  const url = mapUrl(el.dataset.shareUrl || window.location.href);
  const meta = document.querySelector('meta[name="description"]');
  const text = document.body.dataset.shareText || el.dataset.shareText ||
    (meta && meta.content) || document.title;
  return { url, text, title: document.title };
}

export function mountShareBar(el) {
  if (!el || el.dataset.shareMounted) return;
  el.dataset.shareMounted = "1";
  const compact = el.dataset.shareBar === "compact";
  const native = typeof navigator.share === "function";

  el.innerHTML =
    `<span class="share-bar-label">${compact ? "Share" : "Share this page"}</span>` +
    (native ? '<button type="button" class="share-btn share-native" data-share="native">Share…</button>' : "") +
    TARGETS.map((t) =>
      `<a class="share-btn share-${t.id}" data-share="${t.id}" href="#" target="_blank" rel="noopener noreferrer" aria-label="Share on ${esc(t.label)}">${esc(t.label)}</a>`
    ).join("") +
    '<button type="button" class="share-btn share-copy" data-share="copy">Copy link</button>';

  el.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-share]");
    if (!btn) return;
    const { url, text, title } = shareData(el);
    const kind = btn.dataset.share;

    if (kind === "native") {
      ev.preventDefault();
      try { await navigator.share({ title, text, url }); } catch { /* user closed the sheet */ }
      return;
    }
    if (kind === "copy") {
      ev.preventDefault();
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "Link copied ✓";
      } catch {
        window.prompt("Copy this link:", url);
      }
      setTimeout(() => { btn.textContent = "Copy link"; }, 2000);
      return;
    }
    const target = TARGETS.find((t) => t.id === kind);
    if (target) btn.href = target.href(url, text); // set just before the browser follows it
  });
}

export function mountAllShareBars(root = document) {
  root.querySelectorAll("[data-share-bar]").forEach(mountShareBar);
}

// ---------------- One Share button for one item (GS-16) ----------------
// For lists where a full bar per tile would be clutter (tournament tiles).
// Phones get the native share sheet; elsewhere a small menu opens next to
// the button. The button's parent must be position:relative.

let openMenu = null;

function closeShareMenu() {
  if (!openMenu) return;
  openMenu.btn.setAttribute("aria-expanded", "false");
  openMenu.menu.remove();
  document.removeEventListener("click", openMenu.outside, true);
  document.removeEventListener("keydown", openMenu.onKey);
  openMenu = null;
}

/** data = { url, text, title } */
export async function shareItem(btn, data) {
  const wasOpenHere = openMenu && openMenu.btn === btn;
  closeShareMenu();
  if (wasOpenHere) return; // second tap closes it
  data = { ...data, url: mapUrl(data.url) };

  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function") {
    try { await navigator.share(data); return; } catch (err) {
      if (err && err.name === "AbortError") return; // user closed the sheet
    }
  }

  const { url, text } = data;
  const menu = document.createElement("div");
  menu.className = "share-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = TARGETS.map((t) =>
    `<a role="menuitem" class="share-btn share-${t.id}" href="${esc(t.href(url, text))}" target="_blank" rel="noopener noreferrer">${esc(t.label)}</a>`
  ).join("") + '<button type="button" role="menuitem" class="share-btn share-copy">Copy link</button>';
  btn.after(menu);
  btn.setAttribute("aria-expanded", "true");

  menu.addEventListener("click", async (ev) => {
    const copy = ev.target.closest(".share-copy");
    if (!copy) { if (ev.target.closest("a")) setTimeout(closeShareMenu, 0); return; }
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = "Link copied ✓";
      setTimeout(closeShareMenu, 1200);
    } catch {
      closeShareMenu();
      window.prompt("Copy this link:", url);
    }
  });
  const outside = (ev) => { if (!menu.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) closeShareMenu(); };
  const onKey = (ev) => { if (ev.key === "Escape") { closeShareMenu(); btn.focus(); } };
  document.addEventListener("click", outside, true);
  document.addEventListener("keydown", onKey);
  openMenu = { btn, menu, outside, onKey };
  menu.querySelector("[role=menuitem]").focus();
}
