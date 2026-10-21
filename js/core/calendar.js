// ===================== Hub Partner — Calendar layout =====================
//
// Turns courts, their slots and the day's bookings into rows for the day view
// (courts as columns) and the week view (one court, seven days). Pure, so the
// grid logic is tested without a browser.

import { daySlots, addDays, weekdayOf } from "./slots.js";

/**
 * Day view: one column per court, one row per time. Each cell is a slot with
 * the booking that covers it (if any), so the screen only renders.
 */
export function dayGrid(courts, date, { locks, blackouts, bookings = [], now } = {}) {
  const byKey = new Map();
  for (const b of bookings) {
    if (b.status === "cancelled" || b.status === "expired") continue;
    for (const k of b.slotKeys || []) byKey.set(k, b);
  }
  const columns = courts.map((c) => ({
    court: c,
    slots: daySlots(c, date, { locks, blackouts, now }).map((s) => ({ ...s, booking: byKey.get(s.key) || null }))
  }));
  const times = [...new Set(columns.flatMap((col) => col.slots.map((s) => s.start)))].sort();
  return {
    date,
    times,
    columns: columns.map((col) => ({
      court: col.court,
      cells: times.map((t) => col.slots.find((s) => s.start === t) || null)
    }))
  };
}

/** Week view for one court: seven days from `startDate`, with a free count per day. */
export function weekStrip(court, startDate, opts = {}) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startDate, i);
    const slots = daySlots(court, date, opts);
    return {
      date,
      weekday: weekdayOf(date),
      slots,
      free: slots.filter((s) => s.state === "free").length,
      booked: slots.filter((s) => s.state === "booked" || s.state === "held").length
    };
  });
}

/** Totals for the Today screen. Amounts are in rupees. */
export function todaySummary(bookings) {
  const live = bookings.filter((b) => b.status !== "cancelled" && b.status !== "expired");
  const collected = live.reduce((sum, b) => {
    if (b.paymentStatus === "paid") return sum + (Number(b.amount) || 0);
    if (b.offlinePayment === "cash" || b.offlinePayment === "upi") return sum + (Number(b.amount) || 0);
    return sum;
  }, 0);
  return {
    count: live.length,
    pending: live.filter((b) => (b.status || "pending") === "pending").length,
    collected
  };
}
