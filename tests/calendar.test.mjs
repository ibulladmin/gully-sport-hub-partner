import { test } from "node:test";
import assert from "node:assert/strict";
import { dayGrid, weekStrip, todaySummary } from "../js/core/calendar.js";

const hours = { open: "06:00", close: "09:00" };
const all = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, hours]));
const net1 = { id: "n1", name: "Net 1", slotMinutes: 60, basePricePerHour: 500, weeklyHours: all };
const net2 = { id: "n2", name: "Net 2", slotMinutes: 60, basePricePerHour: 500, weeklyHours: { ...all, wed: { open: "07:00", close: "09:00" } } };

test("day grid lines courts up by time and attaches bookings", () => {
  const booking = { id: "b1", status: "confirmed", slotKeys: ["n1_2026-10-21_0700"] };
  const cancelled = { id: "b2", status: "cancelled", slotKeys: ["n2_2026-10-21_0700"] };
  const g = dayGrid([net1, net2], "2026-10-21", { bookings: [booking, cancelled] });
  assert.deepEqual(g.times, ["06:00", "07:00", "08:00"]);
  assert.equal(g.columns[1].cells[0], null, "Net 2 opens at 7 on Wednesdays");
  assert.equal(g.columns[0].cells[1].booking.id, "b1");
  assert.equal(g.columns[1].cells[1].booking, null, "cancelled bookings don't show");
});

test("week strip counts free and booked slots", () => {
  const w = weekStrip(net1, "2026-10-21", { locks: { "n1_2026-10-21_0600": { state: "booked" } } });
  assert.equal(w.length, 7);
  assert.equal(w[0].weekday, "wed");
  assert.deepEqual([w[0].free, w[0].booked], [2, 1]);
});

test("today's summary counts cash and paid online bookings", () => {
  const s = todaySummary([
    { status: "confirmed", paymentStatus: "paid", amount: 600 },
    { status: "confirmed", offlinePayment: "cash", amount: 500 },
    { status: "pending", offlinePayment: "unpaid", amount: 500 },
    { status: "cancelled", paymentStatus: "paid", amount: 900 }
  ]);
  assert.deepEqual(s, { count: 3, pending: 1, collected: 1100 });
});
