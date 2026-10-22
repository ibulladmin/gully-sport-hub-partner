// ===================== Hub Partner — Court slots, prices and locks =====================
//
// Pure functions, no Firebase: the calendar screens, the tests and (later) the
// booking functions in ibull-functions all need the same answers to "which
// slots does this court have on this day, which are free, and what do they
// cost". Keep it that way so the answer is computed one way everywhere.
//
// Dates are "YYYY-MM-DD" and times "HH:mm", both in the facility's local time
// (India, IST). Nothing here reads the device clock or time zone: callers pass
// `now` from istNow(), so a phone set to another zone still sees the right day.

export const SLOT_LENGTHS = [30, 60, 90];
export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DEFAULT_BOOKING_WINDOW_DAYS = 30;
export const DEFAULT_CUTOFF_MINUTES = 60;

const IST_OFFSET_MINUTES = 330;

/** "06:30" → 390. Returns NaN for anything malformed. */
export function toMinutes(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** 390 → "06:30". 1440 (midnight close) → "24:00". */
export function fromMinutes(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "2026-10-21" → "wed". */
export function weekdayOf(date) {
  const [y, mo, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
}

/** Adds whole days to a "YYYY-MM-DD" date. */
export function addDays(date, days) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

/** The current date and minute of the day in IST. */
export function istNow(at = new Date()) {
  const t = new Date(at.getTime() + IST_OFFSET_MINUTES * 60000);
  return { date: t.toISOString().slice(0, 10), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/**
 * The lock id for one slot: `{courtId}_{date}_{HHmm}`. One document per slot,
 * created in the booking's transaction, is what stops a double booking.
 */
export function slotKey(courtId, date, start) {
  return `${courtId}_${date}_${start.replace(":", "")}`;
}

/** Opening hours for one day, or null when the court is closed. */
function hoursOn(court, date) {
  const h = court.weeklyHours && court.weeklyHours[weekdayOf(date)];
  if (!h || h.closed) return null;
  const open = toMinutes(h.open);
  const close = h.close === "24:00" ? 1440 : toMinutes(h.close);
  return open >= 0 && close > open ? { open, close } : null;
}

function blackedOut(blackouts, courtId, date) {
  return (blackouts || []).find((b) =>
    (!b.courtId || b.courtId === courtId) && b.from <= date && date <= (b.to || b.from));
}

/** Price per hour for a slot starting at `startMin` on `date`, peak rules first. */
export function pricePerHourAt(court, date, startMin) {
  const day = weekdayOf(date);
  for (const r of court.peakRules || []) {
    if ((r.days || []).includes(day) && toMinutes(r.from) <= startMin && startMin < toMinutes(r.to)) {
      return Number(r.pricePerHour) || 0;
    }
  }
  return Number(court.basePricePerHour) || 0;
}

/**
 * Every slot of a court on a date, each marked with why it can or can't be
 * booked: "free", "booked", "held", "blackout", "past" or "beyond_window".
 *
 * `locks` maps slotKey → { state: "hold" | "booked", expiresAt?: ms }. A hold
 * past its expiry counts as free; releaseExpiredHolds tidies it up later.
 */
export function daySlots(court, date, { locks = {}, blackouts = [], now, bookingWindowDays = DEFAULT_BOOKING_WINDOW_DAYS, cutoffMinutes = DEFAULT_CUTOFF_MINUTES, nowMs = Date.now() } = {}) {
  const hours = hoursOn(court, date);
  if (!hours || court.active === false) return [];
  const len = SLOT_LENGTHS.includes(court.slotMinutes) ? court.slotMinutes : 60;
  const blackout = blackedOut(blackouts, court.id, date);
  const lastDate = now ? addDays(now.date, bookingWindowDays) : null;

  const out = [];
  for (let start = hours.open; start + len <= hours.close; start += len) {
    const startHHmm = fromMinutes(start);
    const key = slotKey(court.id, date, startHHmm);
    const lock = locks[key];
    let state = "free";
    if (blackout) state = "blackout";
    else if (lock && lock.state === "booked") state = "booked";
    else if (lock && lock.state === "hold" && !(lock.expiresAt && lock.expiresAt < nowMs)) state = "held";
    else if (now && (date < now.date || (date === now.date && start < now.minutes + cutoffMinutes))) state = "past";
    else if (lastDate && date > lastDate) state = "beyond_window";
    out.push({
      key,
      start: startHHmm,
      end: fromMinutes(start + len),
      minutes: len,
      price: Math.round(pricePerHourAt(court, date, start) * len / 60),
      state,
      reason: blackout ? blackout.reason || "Closed" : ""
    });
  }
  return out;
}

/**
 * Checks a player's or partner's pick of slots: all free, back to back, and
 * within the court's min/max. Returns { ok, error?, keys, total, start, end }.
 */
export function checkSelection(court, slots, pickedKeys) {
  const picked = slots.filter((s) => pickedKeys.includes(s.key));
  if (picked.length !== pickedKeys.length) return { ok: false, error: "One of those slots no longer exists." };
  if (!picked.length) return { ok: false, error: "Pick at least one slot." };
  const min = court.minSlots || 1, max = court.maxSlots || 12;
  if (picked.length < min) return { ok: false, error: `Book at least ${min} slot${min === 1 ? "" : "s"}.` };
  if (picked.length > max) return { ok: false, error: `Book at most ${max} slots at a time.` };
  const taken = picked.find((s) => s.state !== "free");
  if (taken) return { ok: false, error: `${taken.start} is not available.` };
  for (let i = 1; i < picked.length; i++) {
    if (picked[i - 1].end !== picked[i].start) return { ok: false, error: "Slots must be back to back." };
  }
  return {
    ok: true,
    keys: picked.map((s) => s.key),
    total: picked.reduce((sum, s) => sum + s.price, 0),
    start: picked[0].start,
    end: picked[picked.length - 1].end
  };
}

/** The first `n` free runs of `count` back-to-back slots, to suggest after a clash. */
export function nextFree(slots, count = 1, n = 3) {
  const out = [];
  for (let i = 0; i + count <= slots.length && out.length < n; i++) {
    const run = slots.slice(i, i + count);
    if (run.every((s, j) => s.state === "free" && (j === 0 || run[j - 1].end === s.start))) out.push(run.map((s) => s.key));
  }
  return out;
}

/**
 * The dates of a recurring series: every listed weekday from `from` to `to`
 * inclusive, capped so one tap can't create thousands of bookings.
 */
export function seriesDates({ from, to, days }, cap = 120) {
  const out = [];
  for (let d = from; d <= to && out.length < cap; d = addDays(d, 1)) {
    if (days.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}
