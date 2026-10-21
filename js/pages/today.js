// Today: bookings across all courts, who's next, and money collected.
import { requirePartner } from "../session.js";
import { myFacilities, listCourts } from "../data/facilities.js";
import { watchBookings } from "../data/bookings.js";
import { istNow } from "../core/slots.js";
import { todaySummary } from "../core/calendar.js";
import { mountNav, facilityPicker, emptyState, esc, inr, timeLabel, dayLabel } from "../ui.js";

mountNav();

requirePartner(async ({ user }) => {
  const facilities = await myFacilities(user.uid);
  const next = document.getElementById("next");
  if (!facilities.length) {
    emptyState(next, 'You haven\'t added a facility yet. <a href="facility.html">Add your first facility</a>.');
    return;
  }
  const today = istNow().date;
  document.getElementById("today-title").textContent = `Today, ${dayLabel(today)}`;
  let stop = () => {};

  async function show(facilityId) {
    stop();
    const courts = await listCourts(facilityId);
    const courtName = Object.fromEntries(courts.map((c) => [c.id, c.name]));
    stop = watchBookings(facilityId, today, (bookings) => {
      const s = todaySummary(bookings);
      document.getElementById("stats").innerHTML = `
        <div class="stat"><b>${s.count}</b><span>bookings</span></div>
        <div class="stat"><b>${s.pending}</b><span>to confirm</span></div>
        <div class="stat"><b>${inr(s.collected)}</b><span>collected</span></div>`;
      const nowHHmm = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      const upcoming = bookings
        .filter((b) => b.status !== "cancelled" && b.status !== "expired" && (b.endTime || b.startTime || "") >= nowHHmm)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
      if (!upcoming.length) return emptyState(next, "Nothing else booked today.");
      next.innerHTML = upcoming.map((b) => `
        <a class="list-item" href="booking.html?id=${encodeURIComponent(b.id)}">
          <span><b>${b.startTime ? esc(timeLabel(b.startTime)) : "—"}</b> · ${esc(courtName[b.courtId] || b.facilityName || "")}</span>
          <span>${esc(b.guestName || b.userName || "Player")} <span class="badge badge-${esc(b.status || "pending")}">${esc(b.status || "pending")}</span></span>
        </a>`).join("");
    }, (err) => emptyState(next, "Could not load bookings. " + esc(err.message)));
  }

  show(facilityPicker(document.getElementById("facility"), facilities, show));
});
