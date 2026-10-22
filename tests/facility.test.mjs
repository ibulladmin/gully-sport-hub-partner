import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, needsReview, basicsProblems, locationProblems, courtProblems, submitProblems } from "../js/core/facility.js";

test("status transitions by actor", () => {
  assert.ok(canTransition("draft", "in_review", "partner"));
  assert.ok(canTransition(undefined, "in_review", "partner"), "a doc with no status is a draft");
  assert.ok(!canTransition("draft", "live", "partner"), "a partner can't approve their own listing");
  assert.ok(!canTransition("in_review", "live", "partner"));
  assert.ok(canTransition("in_review", "live", "admin"));
  assert.ok(canTransition("in_review", "changes_requested", "admin"));
  assert.ok(canTransition("live", "paused", "partner"));
  assert.ok(!canTransition("paused", "live", "nobody"));
});

test("only name, location and photo edits need review", () => {
  const live = { name: "A", city: "Pune", pricePerHour: 500, images: [{ url: "x" }] };
  assert.ok(!needsReview(live, { ...live, pricePerHour: 700, description: "new" }));
  assert.ok(needsReview(live, { ...live, name: "B" }));
  assert.ok(needsReview(live, { ...live, images: [] }));
});

test("wizard step checks", () => {
  assert.deepEqual(basicsProblems({ name: "Net Zone", type: "Nets", sports: ["Cricket"], amenities: ["parking"] }), []);
  assert.equal(basicsProblems({ type: "Pool", sports: [], description: "x".repeat(601), amenities: ["spa"] }).length, 5);
  assert.deepEqual(locationProblems({ address: "1 MG Rd", city: "Pune", geo: { lat: 18.5, lng: 73.8 } }), []);
  assert.match(locationProblems({ address: "x", city: "y", geo: { lat: 0, lng: 0 } })[0], /pin/);
  assert.match(courtProblems([{ name: "Net 1", basePricePerHour: 500 }, { name: "net 1", basePricePerHour: 500 }])[0], /Two courts/);
  assert.match(courtProblems([])[0], /at least one/);
});

test("submit needs everything, including 3 photos", () => {
  const f = { name: "Net Zone", type: "Nets", sports: ["Cricket"], address: "1 MG Rd", city: "Pune", geo: { lat: 18.5, lng: 73.8 } };
  const courts = [{ name: "Net 1", basePricePerHour: 500 }];
  assert.deepEqual(submitProblems(f, courts, [{ kind: "photo" }, { kind: "photo" }]), ["Add 1 more photo (at least 3)."]);
  assert.deepEqual(submitProblems(f, courts, [{ kind: "photo" }, { kind: "photo" }, { kind: "photo" }]), []);
});
