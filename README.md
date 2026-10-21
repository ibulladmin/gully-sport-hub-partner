# GullySport Hub Partner

The partner app for GullySport facility owners: list grounds, nets and turfs
with photos and videos, set when each court can be booked, and run the
booking calendar, including walk-ins, phone bookings and recurring slots.
Players keep booking from the main GullySport app, which reads the same data.

Plain HTML/CSS/JS ES modules, no build step, same as gullysport. It uses the
shared `ibull-innovation` Firebase project and the GullySport sign-in pool, so
partners sign in with their existing GullySport partner account.

## Run it locally

```
npx serve .          # or any static server; open /login.html
npm test             # slot, pricing, calendar, media and listing rules
npm run verify       # web-common copy unchanged, every page import resolves
```

## Layout

| Path | What |
| --- | --- |
| `*.html` | One page per screen: login, today, calendar, facilities, facility (the 5-step wizard), media, booking, settings |
| `js/pages/` | One script per page |
| `js/core/` | Pure logic with tests: slots and prices (`slots.js`), calendar grids (`calendar.js`), listing rules (`facility.js`), media limits (`media.js`) |
| `js/data/` | Firestore, Storage and callable-function access |
| `js/common/` | Pinned copy of ibull-functions `web-common`; never edit by hand |
| `docs/backend.md` | The rules, indexes and functions this app needs from ibull-functions |

## Not here on purpose

Security rules and Cloud Functions live only in **ibull-functions**. See
[docs/backend.md](docs/backend.md) for what this app expects from them.

## Next steps

- Backend pieces in ibull-functions (rules, Storage rules, indexes, `createOfflineBooking`, `cancelFacilityBooking`).
- Firebase Hosting site `gullysport-partner` and a deploy workflow like gullysport's.
- Capacitor shell for iOS and Android, copied from gullysport.
- Map pin picker, mobile verification, staff invites, iCal link.
