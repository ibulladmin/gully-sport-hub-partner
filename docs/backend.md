# What this app needs from ibull-functions

This repo is front end only. Security rules, Storage rules and Cloud Functions
for the whole IBULL Firebase project (`ibull-innovation`) live in
**ibull-functions** and are deployed only from there. Until the pieces below
ship, the screens load but most writes are refused by the current rules.

The design is in the spec, "Gully Sport Hub Partner App: Spec" (Data model and
Screens and API surface sections). This file lists exactly what the code in
this repo calls.

## Firestore

| Path | Read | Write |
| --- | --- | --- |
| `facilities/{id}` | public when `status == "live"`; owner, staff, admin always | owner/staff: everything except `status`, `ownerId`, `staffIds`, `reviewNote`; `status` only `draft`/`changes_requested` → `in_review`, `live` ⇄ `paused`, and a live doc may move itself to `in_review` (see `js/core/facility.js`). Create: `ownerId == auth.uid`, `status == "draft"`, caller's role `facility_owner` |
| `facilities/{id}/courts/{courtId}` | public | owner/staff |
| `facilities/{id}/media/{mediaId}` | public unless `moderation == "hidden"` | owner/staff; `moderation`, `posterUrl`, `url720` only by admin / functions |
| `facilities/{id}/blackouts/{id}` | public | owner/staff |
| `facility_bookings/{id}` | the booking's player, the facility's owner/staff, admin | owner/staff may change only `offlinePayment`, and `status` `pending` → `confirmed` on unpriced requests. Everything else through functions |
| `slot_locks/{courtId}_{date}_{HHmm}` | public (no names or numbers in it) | functions only |
| `users/{uid}` | as today | as today, plus the partner may set their own `gstNumber` |

Queries the app runs (need composite indexes where noted):

- `facilities` where `ownerId == uid`; where `staffIds array-contains uid`
- `facility_bookings` where `facilityId == X` and `date == D` (index: facilityId + date)
- `slot_locks` where `facilityId == X` and `date == D` (index: facilityId + date)

So lock documents carry `facilityId`, `courtId`, `date`, `start`, `bookingId`,
`state` (`hold` | `booked`) and `expiresAt`. Bookings carry `facilityId`,
`courtId`, `date`, `startTime`, `endTime`, `slotKeys[]`, `source`, `amount`.

## Storage

`facility-media/{facilityId}/photos/*`: image/png, image/jpeg, image/webp,
up to 2 MB. `facility-media/{facilityId}/videos/*`: video/mp4,
video/quicktime, up to 50 MB. Write only by the facility's owner or staff
(read `facilities/{facilityId}` with `firestore.get`). Public read.

## Callable functions (region asia-south1)

| Name | Called from | Input | Returns |
| --- | --- | --- | --- |
| `createOfflineBooking` | Calendar, add booking | `{ facilityId, courtId, date, slotKeys[], source: "walk_in" \| "phone" \| "recurring", guestName, guestPhone, offlinePayment, series: { from, to, days[] } \| null }` | `{ bookingIds[], clashes[] }` |
| `cancelFacilityBooking` | Booking detail | `{ bookingId, reason }` | `{ ok }`; deletes the booking's locks in the same transaction |

Both must re-derive slots from the court document (`js/core/slots.js` is
written to be copied or shared for this) and refuse keys that aren't real
slots, rather than trusting the client's `slotKeys`.

Also from the spec, not called directly by this app: the `createPaymentOrder`
and webhook changes for online slot holds, `releaseExpiredHolds`,
`processFacilityVideo`, `reviewFacility` and `facilityCalendarFeed`.
