// Settings: booking window, cut-off, cancellation policy, closures and staff.
import { db } from "../firebase-init.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requirePartner } from "../session.js";
import { myFacilities, listCourts, listBlackouts, addBlackout, deleteBlackout } from "../data/facilities.js";
import { DEFAULT_BOOKING_WINDOW_DAYS, DEFAULT_CUTOFF_MINUTES, istNow } from "../core/slots.js";
import { mountNav, facilityPicker, esc, toast, dayLabel } from "../ui.js";

mountNav();

requirePartner(async ({ user }) => {
  const facilities = await myFacilities(user.uid);
  const form = document.getElementById("settings-form");
  if (!facilities.length) { form.innerHTML = '<div class="empty-state">Add a facility first.</div>'; return; }
  let facility, courts = [];
  const f = (x) => document.getElementById(x);

  async function load(id) {
    facility = facilities.find((x) => x.id === id);
    f("window").value = facility.bookingWindowDays ?? DEFAULT_BOOKING_WINDOW_DAYS;
    f("cutoff").value = facility.cutoffMinutes ?? DEFAULT_CUTOFF_MINUTES;
    f("refund-hours").value = facility.cancelPolicy?.fullRefundHours ?? 24;
    courts = await listCourts(id);
    f("bo-court").innerHTML = '<option value="">Whole facility</option>' + courts.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    f("bo-from").min = istNow().date;
    f("staff").innerHTML = (facility.staffIds || []).length
      ? facility.staffIds.map((s) => `<li class="list-item">${esc(s)}</li>`).join("")
      : '<li class="muted">No staff yet.</li>';
    drawBlackouts();
  }

  async function drawBlackouts() {
    const list = await listBlackouts(facility.id);
    const name = Object.fromEntries(courts.map((c) => [c.id, c.name]));
    f("blackouts").innerHTML = list.sort((a, b) => a.from.localeCompare(b.from)).map((b) => `
      <li class="list-item"><span>${esc(dayLabel(b.from))}${b.to && b.to !== b.from ? ` to ${esc(dayLabel(b.to))}` : ""} · ${esc(b.courtId ? name[b.courtId] || "Court" : "Whole facility")} · ${esc(b.reason || "Closed")}</span>
      <button class="link-btn danger" data-del="${esc(b.id)}">Remove</button></li>`).join("") || '<li class="muted">No closures.</li>';
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const patch = {
      bookingWindowDays: Math.min(180, Math.max(1, Math.round(Number(f("window").value)))),
      cutoffMinutes: Math.min(1440, Math.max(0, Math.round(Number(f("cutoff").value)))),
      cancelPolicy: { fullRefundHours: Math.min(168, Math.max(0, Math.round(Number(f("refund-hours").value)))) }
    };
    try { await updateDoc(doc(db, "facilities", facility.id), patch); Object.assign(facility, patch); toast("Saved."); }
    catch (err) { toast("Could not save: " + err.message); }
  });

  f("blackout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const from = f("bo-from").value, to = f("bo-to").value || from;
    if (to < from) return toast("The end date is before the start date.");
    try {
      await addBlackout(facility.id, { courtId: f("bo-court").value || null, from, to, reason: f("bo-reason").value.trim() });
      e.target.reset();
      drawBlackouts();
    } catch (err) { toast(err.message); }
  });

  f("blackouts").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    await deleteBlackout(facility.id, b.dataset.del).catch((err) => toast(err.message));
    drawBlackouts();
  });

  load(facilityPicker(f("facility"), facilities, load));
});
