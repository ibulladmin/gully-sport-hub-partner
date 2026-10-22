// ===================== Hub Partner — Bookings and slot locks =====================
//
// Reads are direct. Writes that take slots (walk-in, phone, recurring) go
// through the createOfflineBooking function, which creates the booking and its
// slot_locks in one transaction: the client never writes locks itself, so two
// devices can't both think a slot is theirs.

import { app, db } from "../firebase-init.js";
import {
  collection, doc, getDoc, query, where, onSnapshot, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const functions = getFunctions(app, "asia-south1");
const createOfflineBookingFn = httpsCallable(functions, "createOfflineBooking");

/**
 * Live bookings for a facility on a date. Calls `cb(bookings)` on every change
 * and returns the unsubscribe function.
 */
export function watchBookings(facilityId, date, cb, onError) {
  const q = query(collection(db, "facility_bookings"), where("facilityId", "==", facilityId), where("date", "==", date));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/**
 * Live slot locks for a facility on a date, as { slotKey: lock }. Locks hold
 * no names or phone numbers, so the public slot grid can read them too.
 */
export function watchLocks(facilityId, date, cb, onError) {
  const q = query(collection(db, "slot_locks"), where("facilityId", "==", facilityId), where("date", "==", date));
  return onSnapshot(q, (snap) => {
    const out = {};
    snap.forEach((d) => {
      const l = d.data();
      out[d.id] = { ...l, expiresAt: l.expiresAt?.toMillis ? l.expiresAt.toMillis() : l.expiresAt };
    });
    cb(out);
  }, onError);
}

export async function getBooking(id) {
  const snap = await getDoc(doc(db, "facility_bookings", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Walk-in, phone or recurring booking. `series` is { from, to, days } for
 * recurring ones. Resolves to { bookingIds, clashes } — clashes lists dates
 * of a series that were already taken and skipped.
 */
export async function createOfflineBooking({ facilityId, courtId, date, slotKeys, source, guestName, guestPhone, offlinePayment, series }) {
  const { data } = await createOfflineBookingFn({ facilityId, courtId, date, slotKeys, source, guestName, guestPhone, offlinePayment, series: series || null });
  return data;
}

/** Marks an offline booking's payment (cash / upi / unpaid). */
export function setOfflinePayment(id, offlinePayment) {
  return updateDoc(doc(db, "facility_bookings", id), { offlinePayment });
}

/** Confirms an unpriced online request. */
export function confirmRequest(id) {
  return updateDoc(doc(db, "facility_bookings", id), { status: "confirmed" });
}

/**
 * Cancels a booking and frees its slots at once (cancelFacilityBooking). A
 * paid online booking is refunded separately, through refundPayment.
 */
export async function cancelBooking(id, reason) {
  const { data } = await httpsCallable(functions, "cancelFacilityBooking")({ bookingId: id, reason: reason || "" });
  return data;
}
