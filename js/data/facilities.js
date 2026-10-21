// ===================== Hub Partner — Facilities, courts and blackouts =====================
//
// Straight Firestore reads and writes; the security rules in ibull-functions
// decide who may do what. Status changes the partner may make are checked here
// first (canTransition) only to give a clear message.

import { db } from "../firebase-init.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { canTransition, needsReview, submitProblems } from "../core/facility.js";
import { listMedia } from "./media.js";

const facilities = collection(db, "facilities");
const withId = (d) => ({ id: d.id, ...d.data() });

/** Facilities this account owns or is staff on, newest first. */
export async function myFacilities(uid) {
  const [owned, staffed] = await Promise.all([
    getDocs(query(facilities, where("ownerId", "==", uid))),
    getDocs(query(facilities, where("staffIds", "array-contains", uid)))
  ]);
  const byId = new Map();
  for (const d of [...owned.docs, ...staffed.docs]) byId.set(d.id, withId(d));
  return [...byId.values()].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getFacility(id) {
  const snap = await getDoc(doc(db, "facilities", id));
  return snap.exists() ? withId(snap) : null;
}

/** A new draft owned by `uid`. Returns its id. */
export async function createDraft(uid, basics) {
  const ref = await addDoc(facilities, {
    ...basics,
    ownerId: uid,
    staffIds: [],
    status: "draft",
    images: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Saves wizard fields. A live facility whose name, location or photos change
 * goes back to review; everything else takes effect at once.
 */
export async function saveFacility(before, changes) {
  const after = { ...before, ...changes };
  const patch = { ...changes, updatedAt: serverTimestamp() };
  if (before.status === "live" && needsReview(before, after)) patch.status = "in_review";
  await updateDoc(doc(db, "facilities", before.id), patch);
  return { ...after, status: patch.status || before.status };
}

/** Submits a draft for review, or returns the list of what's still missing. */
export async function submitForReview(facility) {
  if (!canTransition(facility.status, "in_review", "partner")) return [`A ${facility.status} facility can't be submitted.`];
  const [courts, media] = await Promise.all([listCourts(facility.id), listMedia(facility.id)]);
  const problems = submitProblems(facility, courts, media);
  if (problems.length) return problems;
  await updateDoc(doc(db, "facilities", facility.id), { status: "in_review", submittedAt: serverTimestamp() });
  return [];
}

export async function setPaused(facility, paused) {
  const to = paused ? "paused" : "live";
  if (!canTransition(facility.status, to, "partner")) throw new Error(`Can't change a ${facility.status} facility to ${to}.`);
  await updateDoc(doc(db, "facilities", facility.id), { status: to });
}

// ---- Courts: facilities/{id}/courts/{courtId} ----

export async function listCourts(facilityId) {
  const snap = await getDocs(query(collection(db, "facilities", facilityId, "courts"), orderBy("name")));
  return snap.docs.map(withId);
}

export async function saveCourt(facilityId, court) {
  const { id, ...data } = court;
  if (id) {
    await setDoc(doc(db, "facilities", facilityId, "courts", id), data, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, "facilities", facilityId, "courts"), { active: true, ...data });
  return ref.id;
}

export function deleteCourt(facilityId, courtId) {
  return deleteDoc(doc(db, "facilities", facilityId, "courts", courtId));
}

// ---- Blackouts: facilities/{id}/blackouts/{id} ----

export async function listBlackouts(facilityId) {
  const snap = await getDocs(collection(db, "facilities", facilityId, "blackouts"));
  return snap.docs.map(withId);
}

export function addBlackout(facilityId, { courtId = null, from, to, reason }) {
  return addDoc(collection(db, "facilities", facilityId, "blackouts"), { courtId, from, to: to || from, reason: reason || "" });
}

export function deleteBlackout(facilityId, id) {
  return deleteDoc(doc(db, "facilities", facilityId, "blackouts", id));
}
