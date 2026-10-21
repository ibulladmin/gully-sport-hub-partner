import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinutes, fromMinutes, weekdayOf, addDays, istNow, slotKey, daySlots, checkSelection, nextFree, seriesDates, pricePerHourAt } from "../js/core/slots.js";

const court = {
  id: "c1",
  slotMinutes: 60,
  basePricePerHour: 600,
  peakRules: [{ days: ["sat", "sun"], from: "06:00", to: "10:00", pricePerHour: 900 }],
  weeklyHours: {
    mon: { open: "06:00", close: "10:00" }, tue: { open: "06:00", close: "10:00" },
    wed: { open: "06:00", close: "10:00" }, thu: { open: "06:00", close: "10:00" },
    fri: { open: "06:00", close: "10:00" }, sat: { open: "06:00", close: "10:00" },
    sun: { closed: true }
  },
  minSlots: 1,
  maxSlots: 3
};

test("time helpers", () => {
  assert.equal(toMinutes("06:30"), 390);
  assert.ok(Number.isNaN(toMinutes("6:30")));
  assert.equal(fromMinutes(390), "06:30");
  assert.equal(weekdayOf("2026-10-21"), "wed");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.deepEqual(istNow(new Date("2026-10-21T20:00:00Z")), { date: "2026-10-22", minutes: 90 });
  assert.equal(slotKey("c1", "2026-10-21", "06:00"), "c1_2026-10-21_0600");
});

test("a day's slots follow opening hours and the slot length", () => {
  const s = daySlots(court, "2026-10-21");
  assert.deepEqual(s.map((x) => x.start), ["06:00", "07:00", "08:00", "09:00"]);
  assert.equal(s[0].end, "07:00");
  assert.equal(s[0].price, 600);
  assert.equal(daySlots(court, "2026-10-25").length, 0, "closed on Sunday");
  assert.equal(daySlots({ ...court, slotMinutes: 90 }, "2026-10-21").length, 2, "only whole slots fit");
  assert.equal(daySlots({ ...court, active: false }, "2026-10-21").length, 0);
});

test("peak prices apply on matching days and times", () => {
  assert.equal(pricePerHourAt(court, "2026-10-24", 360), 900);
  assert.equal(pricePerHourAt(court, "2026-10-21", 360), 600);
  assert.equal(daySlots({ ...court, slotMinutes: 30 }, "2026-10-24")[0].price, 450);
});

test("locks, holds, blackouts, cutoff and booking window", () => {
  const now = { date: "2026-10-21", minutes: 6 * 60 + 30 };
  const locks = {
    "c1_2026-10-22_0700": { state: "booked" },
    "c1_2026-10-22_0800": { state: "hold", expiresAt: 2000 },
    "c1_2026-10-22_0900": { state: "hold", expiresAt: 500 }
  };
  const s = daySlots(court, "2026-10-22", { locks, now, nowMs: 1000 });
  assert.deepEqual(s.map((x) => x.state), ["free", "booked", "held", "free"], "an expired hold is free");
  const today = daySlots(court, "2026-10-21", { now });
  assert.deepEqual(today.map((x) => x.state), ["past", "past", "free", "free"], "1 hour cutoff");
  assert.equal(daySlots(court, "2026-11-30", { now })[0].state, "beyond_window");
  const closed = daySlots(court, "2026-10-22", { blackouts: [{ courtId: null, from: "2026-10-22", to: "2026-10-23", reason: "Relaying pitch" }] });
  assert.ok(closed.every((x) => x.state === "blackout" && x.reason === "Relaying pitch"));
  const other = daySlots(court, "2026-10-22", { blackouts: [{ courtId: "c2", from: "2026-10-22" }] });
  assert.ok(other.every((x) => x.state === "free"), "another court's blackout");
});

test("a selection must be free, back to back and within min/max", () => {
  const slots = daySlots(court, "2026-10-22", { locks: { "c1_2026-10-22_0800": { state: "booked" } } });
  const k = (t) => `c1_2026-10-22_${t}`;
  const ok = checkSelection(court, slots, [k("0600"), k("0700")]);
  assert.deepEqual(ok, { ok: true, keys: [k("0600"), k("0700")], total: 1200, start: "06:00", end: "08:00" });
  assert.match(checkSelection(court, slots, [k("0700"), k("0800")]).error, /08:00 is not available/);
  assert.match(checkSelection(court, slots, [k("0600"), k("0900")]).error, /back to back/);
  assert.match(checkSelection({ ...court, maxSlots: 1 }, slots, [k("0600"), k("0700")]).error, /at most 1/);
  assert.match(checkSelection(court, slots, []).error, /at least one/);
  assert.match(checkSelection(court, slots, ["nope"]).error, /no longer exists/);
});

test("next free runs skip taken slots", () => {
  const slots = daySlots(court, "2026-10-22", { locks: { "c1_2026-10-22_0700": { state: "booked" } } });
  assert.deepEqual(nextFree(slots, 2), [["c1_2026-10-22_0800", "c1_2026-10-22_0900"]]);
  assert.equal(nextFree(slots, 1).length, 3);
});

test("a recurring series lists the chosen weekdays and is capped", () => {
  assert.deepEqual(seriesDates({ from: "2026-10-20", to: "2026-10-31", days: ["tue", "thu"] }),
    ["2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29"]);
  assert.equal(seriesDates({ from: "2026-01-01", to: "2027-12-31", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] }).length, 120);
});
