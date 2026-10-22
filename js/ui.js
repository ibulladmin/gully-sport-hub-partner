// ===================== Hub Partner — Shared screen pieces =====================

import { esc } from "./common/html.js";
import { inr } from "./common/format.js";
import { STATUS_LABELS } from "./core/facility.js";

export { esc, inr };

const TABS = [
  ["today.html", "Today", "◷"],
  ["calendar.html", "Calendar", "▦"],
  ["facilities.html", "Facilities", "⌂"],
  ["settings.html", "Settings", "⚙"]
];

/** Bottom tab bar on phones, side rail on wide screens. */
export function mountNav() {
  const here = location.pathname.split("/").pop() || "today.html";
  const nav = document.createElement("nav");
  nav.className = "tabbar";
  nav.setAttribute("aria-label", "Main");
  nav.innerHTML = TABS.map(([href, label, icon]) =>
    `<a href="${href}"${here === href ? ' aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${label}</a>`).join("");
  document.body.appendChild(nav);
}

export function statusBadge(status) {
  const s = status || "draft";
  return `<span class="badge badge-${esc(s)}">${esc(STATUS_LABELS[s] || s)}</span>`;
}

let toastTimer;
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

/** "Wed 21 Oct" from "2026-10-21". */
export function dayLabel(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "6:00 am" from "06:00". */
export function timeLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 || h === 24 ? "am" : "pm"}`;
}

/** Fills a <select> with the partner's facilities and remembers the last pick. */
export function facilityPicker(select, facilities, onChange) {
  let last = "";
  try { last = localStorage.getItem("hub.facility") || ""; } catch { /* private mode */ }
  select.innerHTML = facilities.map((f) => `<option value="${esc(f.id)}">${esc(f.name || "Untitled facility")}</option>`).join("");
  if (facilities.some((f) => f.id === last)) select.value = last;
  select.addEventListener("change", () => {
    try { localStorage.setItem("hub.facility", select.value); } catch { /* ignore */ }
    onChange(select.value);
  });
  return select.value;
}

export function emptyState(el, html) {
  el.innerHTML = `<div class="empty-state">${html}</div>`;
}
