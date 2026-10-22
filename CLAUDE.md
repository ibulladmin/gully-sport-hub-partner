# GullySport Hub Partner

Partner app for facility owners: facility registration with photos and videos,
court availability, and the booking calendar. Plain HTML/CSS/JS ES modules,
no build step. Spec: "Gully Sport Hub Partner App: Spec" (Claude Doc).

## Working agreement (same in every IBULL repo)

Follow the working agreement in gullysport's CLAUDE.md: requirements first in
`D:\REQUIREMENTS.md` and `D:\PENDING.md`, branch → PR → merge only when the
user says "deploy", never push straight to `main`, rules and functions only in
ibull-functions, shared helpers only through `js/common/` (web-common), escape
every user-typed value before `innerHTML` (`esc`), https-only user links and
images, prices read server-side only.

## This repo

- **Firebase:** same project (`ibull-innovation`) and sign-in tenant as
  gullysport (`js/firebase-init.js`, copied from gullysport; keep in step).
- **Collections:** extends `facilities` and `facility_bookings`; adds
  `facilities/{id}/courts|media|blackouts` and `slot_locks`. What the rules
  and functions must allow is in `docs/backend.md`; update it with any new
  read, write or callable.
- **Slot locks:** the client never writes `slot_locks`. Bookings that take
  slots go through callable functions so the lock is taken in a transaction.
- **Pure logic** lives in `js/core/` with tests in `tests/` (`npm test`).
  Keep Firebase out of it, so the same code can price and validate slots
  server-side.
- **CI:** `npm test` and `npm run verify` (web-common pin, page imports).
- **Hosting site** `gullysport-partner` (https://gullysport-partner.web.app).
  `deploy.yml`: PR → 7-day preview channel, `main` → live, closed PR → channel
  deleted. Keyless Google auth from repo variables `GCP_WIF_PROVIDER` and
  `GCP_DEPLOY_SA`. Hosting only.
- Requirement IDs for this app: `GS-P`.
