// Calendar: a day view with courts as columns, or a week view for one court.
// Tap a free slot to add a walk-in, phone or recurring booking; tap a booking
// to open it.
import { requirePartner } from "../session.js";
import { myFacilities, listCourts, listBlackouts } from "../data/facilities.js";
import { watchBookings, watchLocks, createOfflineBooking } from "../data/bookings.js";
import { istNow, addDays, daySlots, checkSelection, weekdayOf } from "../core/slots.js";
import { dayGrid, weekStrip } from "../core/calendar.js";
import { mountNav, facilityPicker, emptyState, esc, timeLabel, dayLabel, toast } from "../ui.js";

mountNav();

requirePartner(async ({ user }) => {
  const grid = document.getElementById("grid");
  const facilities = await myFacilities(user.uid);
  if (!facilities.length) return emptyState(grid, 'Add a facility first. <a href="facility.html">Add facility</a>');

  const dateInput = document.getElementById("date");
  const weekCourt = document.getElementById("week-court");
  const now = istNow();
  const state = { facilityId: null, date: now.date, view: "day", courts: [], blackouts: [], bookings: [], locks: {} };
  let unsub = [];
  dateInput.value = state.date;

  async function load(facilityId) {
    state.facilityId = facilityId;
    [state.courts, state.blackouts] = await Promise.all([listCourts(facilityId), listBlackouts(facilityId)]);
    state.courts = state.courts.filter((c) => c.active !== false);
    weekCourt.innerHTML = state.courts.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    subscribe();
  }

  // Day view needs one day's bookings and locks; week view needs seven days of locks.
  function subscribe() {
    unsub.forEach((u) => u());
    unsub = [];
    const days = state.view === "day" ? [state.date] : Array.from({ length: 7 }, (_, i) => addDays(state.date, i));
    const bookingsByDay = {}, locksByDay = {};
    const onErr = (err) => emptyState(grid, "Could not load the calendar. " + esc(err.message));
    for (const d of days) {
      unsub.push(watchLocks(state.facilityId, d, (l) => { locksByDay[d] = l; state.locks = Object.assign({}, ...Object.values(locksByDay)); render(); }, onErr));
      if (state.view === "day") unsub.push(watchBookings(state.facilityId, d, (b) => { bookingsByDay[d] = b; state.bookings = b; render(); }, onErr));
    }
  }

  function render() {
    if (!state.courts.length) return emptyState(grid, `This facility has no courts yet. <a href="facility.html?id=${encodeURIComponent(state.facilityId)}">Add courts</a>`);
    const opts = { locks: state.locks, blackouts: state.blackouts, now: istNow(), bookings: state.bookings };
    if (state.view === "day") {
      const g = dayGrid(state.courts, state.date, opts);
      if (!g.times.length) return emptyState(grid, `Closed on ${esc(dayLabel(state.date))}.`);
      grid.innerHTML = `<table class="cal"><thead><tr><th></th>${g.columns.map((c) => `<th>${esc(c.court.name)}</th>`).join("")}</tr></thead><tbody>${
        g.times.map((t, r) => `<tr><th>${esc(timeLabel(t))}</th>${g.columns.map((col) => cell(col.court, col.cells[r])).join("")}</tr>`).join("")
      }</tbody></table>`;
    } else {
      const court = state.courts.find((c) => c.id === weekCourt.value) || state.courts[0];
      const week = weekStrip(court, state.date, opts);
      grid.innerHTML = `<div class="week">${week.map((d) => `
        <section><h3>${esc(dayLabel(d.date))}</h3><p class="muted small">${d.free} free · ${d.booked} booked</p>
        ${d.slots.map((s) => `<button class="slot ${s.state}" data-date="${d.date}" data-court="${esc(court.id)}" data-key="${esc(s.key)}"${s.state === "free" ? "" : " disabled"}>${esc(timeLabel(s.start))}</button>`).join("")}
        </section>`).join("")}</div>`;
    }
  }

  function cell(court, s) {
    if (!s) return '<td class="closed"></td>';
    if (s.booking) {
      const b = s.booking;
      return `<td class="${s.state}"><a href="booking.html?id=${encodeURIComponent(b.id)}">${esc(b.guestName || b.userName || "Booked")}</a></td>`;
    }
    if (s.state === "free") return `<td class="free"><button data-date="${state.date}" data-court="${esc(court.id)}" data-key="${esc(s.key)}" aria-label="Add booking at ${esc(timeLabel(s.start))}">+</button></td>`;
    return `<td class="${s.state}" title="${esc(s.reason || s.state)}">${s.state === "blackout" ? esc(s.reason || "Closed") : ""}</td>`;
  }

  // ---- Walk-in / phone / recurring ----
  const dlg = document.getElementById("walkin");
  const f = (id) => document.getElementById(id);
  let pending = null;
  f("walkin-days").innerHTML = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) =>
    `<label class="chip"><input type="checkbox" value="${d}"> ${d[0].toUpperCase() + d.slice(1)}</label>`).join("");
  f("walkin-source").addEventListener("change", () => { f("walkin-series").hidden = f("walkin-source").value !== "recurring"; });

  grid.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-key]");
    if (!b) return;
    const court = state.courts.find((c) => c.id === b.dataset.court);
    const slots = daySlots(court, b.dataset.date, { locks: state.locks, blackouts: state.blackouts, now: istNow() });
    const i = slots.findIndex((s) => s.key === b.dataset.key);
    pending = { court, date: b.dataset.date, slots, i };
    const maxRun = Math.min(court.maxSlots || 4, slots.length - i);
    f("walkin-len").innerHTML = Array.from({ length: maxRun }, (_, n) => n + 1)
      .filter((n) => n >= (court.minSlots || 1))
      .map((n) => `<option value="${n}">${n} × ${court.slotMinutes || 60} min (until ${esc(timeLabel(slots[i + n - 1].end))})</option>`).join("");
    f("walkin-slot").textContent = `${court.name}, ${dayLabel(pending.date)}, from ${timeLabel(slots[i].start)}`;
    f("walkin-days").querySelectorAll("input").forEach((x) => (x.checked = x.value === weekdayOf(pending.date)));
    f("walkin-until").value = addDays(pending.date, 56);
    f("walkin-error").hidden = true;
    f("walkin-name").value = "";
    f("walkin-phone").value = "";
    f("walkin-source").value = "walk_in";
    f("walkin-series").hidden = true;
    dlg.showModal();
  });

  f("walkin-form").addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "save") return;
    e.preventDefault();
    const n = Number(f("walkin-len").value);
    const keys = pending.slots.slice(pending.i, pending.i + n).map((s) => s.key);
    const sel = checkSelection(pending.court, pending.slots, keys);
    const err = f("walkin-error");
    if (!sel.ok) { err.textContent = sel.error; err.hidden = false; return; }
    const source = f("walkin-source").value;
    const btn = f("walkin-save");
    btn.disabled = true;
    try {
      const out = await createOfflineBooking({
        facilityId: state.facilityId,
        courtId: pending.court.id,
        date: pending.date,
        slotKeys: sel.keys,
        source,
        guestName: f("walkin-name").value.trim(),
        guestPhone: f("walkin-phone").value.trim(),
        offlinePayment: f("walkin-pay").value,
        series: source === "recurring"
          ? { from: pending.date, to: f("walkin-until").value, days: [...f("walkin-days").querySelectorAll("input:checked")].map((x) => x.value) }
          : null
      });
      dlg.close();
      toast(out?.clashes?.length ? `Booked. Skipped ${out.clashes.length} date(s) already taken.` : "Booking added.");
    } catch (e2) {
      err.textContent = /already|exists|taken/i.test(e2.message) ? "Someone just booked one of those slots. Pick another time." : e2.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Toolbar ----
  const setDate = (d) => { state.date = d; dateInput.value = d; subscribe(); render(); };
  f("prev").addEventListener("click", () => setDate(addDays(state.date, state.view === "day" ? -1 : -7)));
  f("next").addEventListener("click", () => setDate(addDays(state.date, state.view === "day" ? 1 : 7)));
  dateInput.addEventListener("change", () => dateInput.value && setDate(dateInput.value));
  for (const v of ["day", "week"]) {
    f(`view-${v}`).addEventListener("click", () => {
      state.view = v;
      f("view-day").setAttribute("aria-selected", v === "day");
      f("view-week").setAttribute("aria-selected", v === "week");
      weekCourt.hidden = v === "day";
      subscribe();
      render();
    });
  }
  weekCourt.addEventListener("change", render);

  load(facilityPicker(document.getElementById("facility"), facilities, load));
});
