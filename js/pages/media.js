// Media manager: upload, reorder, set cover, caption, tag to a court, delete.
import { requirePartner } from "../session.js";
import { getFacility, listCourts } from "../data/facilities.js";
import { listMedia, addPhoto, addClip, addLink, updateItem, reorder, removeItem, syncFacilityImages } from "../data/media.js";
import { countByKind, MIN_PHOTOS } from "../core/media.js";
import { mountNav, esc, toast } from "../ui.js";

mountNav();

requirePartner(async () => {
  const id = new URLSearchParams(location.search).get("id");
  const facility = id && await getFacility(id);
  const list = document.getElementById("media");
  if (!facility) { list.innerHTML = '<li class="empty-state">That facility doesn\'t exist or isn\'t yours.</li>'; return; }
  document.getElementById("back").href = `facility.html?id=${encodeURIComponent(id)}`;
  document.getElementById("back").textContent = `‹ ${facility.name || "Facility"}`;

  const courts = await listCourts(id);
  let media = await listMedia(id);
  let cover = facility.coverPhotoId || null;
  const progress = document.getElementById("progress");

  const thumb = (m) => m.kind === "photo"
    ? `<img src="${esc(m.url)}" alt="${esc(m.caption || "")}" loading="lazy">`
    : m.posterUrl ? `<img src="${esc(m.posterUrl)}" alt="" loading="lazy"><span class="play" aria-hidden="true">▶</span>`
    : `<div class="placeholder">${m.kind === "video" ? "Processing video…" : "Video link"}</div>`;

  function render() {
    const n = countByKind(media);
    list.innerHTML = media.map((m) => `
      <li draggable="true" data-id="${esc(m.id)}" class="${m.id === cover ? "cover" : ""}">
        ${thumb(m)}
        ${m.moderation === "hidden" ? '<span class="badge badge-changes_requested">Hidden by review</span>' : ""}
        <input class="caption" value="${esc(m.caption || "")}" maxlength="80" placeholder="Caption" aria-label="Caption">
        <select class="court" aria-label="Court"><option value="">Whole facility</option>${courts.map((c) =>
          `<option value="${esc(c.id)}"${m.courtId === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <div class="row-wrap">
          ${m.kind === "photo" ? `<button class="link-btn set-cover"${m.id === cover ? " disabled" : ""}>${m.id === cover ? "Cover" : "Make cover"}</button>` : ""}
          <button class="link-btn danger remove">Delete</button>
        </div>
      </li>`).join("") || '<li class="empty-state">No photos yet.</li>';
    progress.hidden = n.photo >= MIN_PHOTOS;
    progress.textContent = n.photo < MIN_PHOTOS ? `Add at least ${MIN_PHOTOS - n.photo} more photo${MIN_PHOTOS - n.photo === 1 ? "" : "s"}.` : "";
  }

  async function changed() {
    cover = await syncFacilityImages(id, media, cover);
    render();
  }

  async function run(label, fn) {
    progress.hidden = false;
    progress.textContent = label;
    try { await fn(); } catch (err) { toast(err.message); }
    await changed();
  }

  document.getElementById("photos").addEventListener("change", (e) => run("Uploading…", async () => {
    for (const [i, file] of [...e.target.files].entries()) {
      media.push(await addPhoto(id, file, media, (p) => (progress.textContent = `Uploading photo ${i + 1} of ${e.target.files.length}: ${Math.round(p * 100)}%`)));
    }
    e.target.value = "";
  }));

  document.getElementById("clip").addEventListener("change", (e) => run("Uploading video…", async () => {
    media.push(await addClip(id, e.target.files[0], media, (p) => (progress.textContent = `Uploading video: ${Math.round(p * 100)}%`)));
    e.target.value = "";
  }));

  document.getElementById("link-form").addEventListener("submit", (e) => {
    e.preventDefault();
    run("Adding link…", async () => {
      media.push(await addLink(id, document.getElementById("link").value, media));
      document.getElementById("link").value = "";
    });
  });

  list.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    const m = media.find((x) => x.id === li.dataset.id);
    if (e.target.closest(".set-cover")) { cover = m.id; run("Saving…", async () => {}); }
    if (e.target.closest(".remove") && confirm("Delete this from your listing?")) {
      run("Deleting…", async () => { await removeItem(id, m); media = media.filter((x) => x !== m); });
    }
  });

  list.addEventListener("change", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    const m = media.find((x) => x.id === li.dataset.id);
    const patch = e.target.classList.contains("caption") ? { caption: e.target.value.trim() } : { courtId: e.target.value || null };
    Object.assign(m, patch);
    updateItem(id, m.id, patch).catch((err) => toast(err.message));
  });

  // Drag to reorder (mouse and touch-capable browsers that support HTML5 drag).
  let dragging = null;
  list.addEventListener("dragstart", (e) => { dragging = e.target.closest("li"); });
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const over = e.target.closest("li[data-id]");
    if (over && dragging && over !== dragging) {
      const after = [...list.children].indexOf(over) > [...list.children].indexOf(dragging);
      list.insertBefore(dragging, after ? over.nextSibling : over);
    }
  });
  list.addEventListener("drop", (e) => {
    e.preventDefault();
    const ids = [...list.querySelectorAll("li[data-id]")].map((li) => li.dataset.id);
    media = ids.map((x, i) => Object.assign(media.find((m) => m.id === x), { order: i }));
    run("Saving order…", () => reorder(id, ids));
  });

  render();
});
