// The partner's facilities with their review status.
import { requirePartner } from "../session.js";
import { myFacilities, setPaused } from "../data/facilities.js";
import { mountNav, statusBadge, emptyState, esc, toast } from "../ui.js";

mountNav();

requirePartner(async ({ user }) => {
  const list = document.getElementById("list");
  let facilities = [];
  try {
    facilities = await myFacilities(user.uid);
  } catch (err) {
    return emptyState(list, "Could not load your facilities. " + esc(err.message));
  }
  if (!facilities.length) {
    return emptyState(list, "No facilities yet. Add your ground, nets or turf and we'll review it within a day or two.");
  }
  const render = () => {
    list.innerHTML = facilities.map((f) => `
      <article class="card facility">
        ${f.images?.[0]?.url ? `<img src="${esc(f.images[0].url)}" alt="" loading="lazy">` : '<div class="placeholder" aria-hidden="true">⌂</div>'}
        <div>
          <h2>${esc(f.name || "Untitled facility")} ${statusBadge(f.status)}</h2>
          <p class="muted">${esc([f.type, f.city].filter(Boolean).join(" · "))}</p>
          ${f.status === "changes_requested" && f.reviewNote ? `<p class="alert">${esc(f.reviewNote)}</p>` : ""}
          <div class="row-wrap">
            <a class="btn btn-ghost" href="facility.html?id=${encodeURIComponent(f.id)}">${f.status === "draft" || !f.status ? "Continue setup" : "Edit"}</a>
            <a class="btn btn-ghost" href="media.html?id=${encodeURIComponent(f.id)}">Photos and videos</a>
            ${f.status === "live" ? `<button class="btn btn-ghost" data-pause="${esc(f.id)}">Pause bookings</button>` : ""}
            ${f.status === "paused" ? `<button class="btn btn-ghost" data-resume="${esc(f.id)}">Resume bookings</button>` : ""}
          </div>
        </div>
      </article>`).join("");
  };
  render();

  list.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pause],[data-resume]");
    if (!b) return;
    const f = facilities.find((x) => x.id === (b.dataset.pause || b.dataset.resume));
    const pause = !!b.dataset.pause;
    if (pause && !confirm("Players won't be able to book this facility until you resume. Existing bookings stay.")) return;
    try {
      await setPaused(f, pause);
      f.status = pause ? "paused" : "live";
      render();
      toast(pause ? "Bookings paused." : "Bookings resumed.");
    } catch (err) {
      toast(err.message);
    }
  });
});
