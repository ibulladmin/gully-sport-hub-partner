// ===================== Hub Partner — Facility listing rules =====================
//
// Pure functions for the five-step registration wizard and the review flow.
// The security rules in ibull-functions enforce the same status transitions;
// these exist so the app can explain a refusal before it happens.

export const FACILITY_TYPES = ["Nets", "Turf", "Ground", "Stadium", "Gym"];

export const AMENITIES = [
  ["parking", "Parking"],
  ["floodlights", "Floodlights"],
  ["washroom", "Washroom"],
  ["changing_room", "Changing room"],
  ["drinking_water", "Drinking water"],
  ["equipment_hire", "Equipment on hire"],
  ["cafeteria", "Cafeteria"]
];

export const MAX_DESCRIPTION = 600;

// draft → in_review (partner submits) → live | changes_requested (admin).
// changes_requested → in_review (partner resubmits). live ⇄ paused (partner).
export const STATUS_LABELS = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  live: "Live",
  paused: "Paused"
};

const TRANSITIONS = {
  partner: {
    draft: ["in_review"],
    changes_requested: ["in_review"],
    live: ["paused", "in_review"],
    paused: ["live"]
  },
  admin: {
    in_review: ["live", "changes_requested"],
    live: ["paused", "changes_requested"],
    paused: ["live"]
  }
};

export function canTransition(from, to, actor) {
  return (TRANSITIONS[actor]?.[from || "draft"] || []).includes(to);
}

// Edits to these on a live facility go back for review. Everything else
// (prices, hours, description) takes effect at once.
export const REVIEWED_FIELDS = ["name", "address", "city", "geo", "images", "coverPhotoId"];

export function needsReview(before, after) {
  return REVIEWED_FIELDS.some((f) => JSON.stringify(before?.[f] ?? null) !== JSON.stringify(after?.[f] ?? null));
}

/** The wizard steps, each with a check that returns a list of problems. */
export const WIZARD_STEPS = [
  { id: "account", label: "Partner account" },
  { id: "basics", label: "Basics" },
  { id: "location", label: "Location" },
  { id: "courts", label: "Courts" },
  { id: "media", label: "Media and hours" }
];

export function basicsProblems(f) {
  const p = [];
  if (!String(f.name || "").trim()) p.push("Add the facility's name.");
  if (!FACILITY_TYPES.includes(f.type)) p.push("Pick a facility type.");
  if (!(f.sports || []).length) p.push("Add at least one sport.");
  if (String(f.description || "").length > MAX_DESCRIPTION) p.push(`Keep the description under ${MAX_DESCRIPTION} characters.`);
  const known = new Set(AMENITIES.map(([k]) => k));
  if ((f.amenities || []).some((a) => !known.has(a))) p.push("Unknown amenity.");
  return p;
}

export function locationProblems(f) {
  const p = [];
  if (!String(f.address || "").trim()) p.push("Add the address.");
  if (!String(f.city || "").trim()) p.push("Pick the city.");
  const g = f.geo || {};
  if (!(Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180) || (g.lat === 0 && g.lng === 0)) p.push("Drop a pin on the map.");
  return p;
}

export function courtProblems(courts) {
  const p = [];
  if (!courts.length) p.push("Add at least one court, net or ground.");
  const names = new Set();
  for (const c of courts) {
    const n = String(c.name || "").trim();
    if (!n) p.push("Every court needs a name.");
    else if (names.has(n.toLowerCase())) p.push(`Two courts are called "${n}".`);
    names.add(n.toLowerCase());
    if (!(Number(c.basePricePerHour) >= 0)) p.push(`Set a price for ${n || "each court"}.`);
  }
  return p;
}

/** Everything still missing before the facility can be submitted for review. */
export function submitProblems(facility, courts, media) {
  const photos = (media || []).filter((m) => m.kind === "photo").length;
  return [
    ...basicsProblems(facility),
    ...locationProblems(facility),
    ...courtProblems(courts || []),
    ...(photos < 3 ? [`Add ${3 - photos} more photo${3 - photos === 1 ? "" : "s"} (at least 3).`] : [])
  ];
}
