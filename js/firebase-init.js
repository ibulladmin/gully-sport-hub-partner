// ===================== Hub Partner — Firebase initialization =====================
//
// Same Firebase project and sign-in pool as GullySport (ibull-innovation,
// tenant GullySport-kp4uh): a partner signs in with their GullySport account.
// Copied from gullysport/js/firebase-init.js; keep the two in step.
//
// IMPORTANT: imports use the full gstatic URLs, NOT the bare "firebase/app"
// specifiers shown in the Firebase Console. Bare specifiers require a bundler
// (npm/webpack/vite); this is a plain static site with no build step, so the
// browser needs a real URL it can fetch. If you ever re-paste the config from
// the Console, keep these import lines and replace only the firebaseConfig
// object below.
//
// NOTE: these values are not secrets — Firebase web config is public by design.
// Access control lives entirely in firestore.rules.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  CustomProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";
import { isNativeApp, nativePlugin } from "./platform.js";

// With the app's own address as authDomain, Google's sign-in screen names it
// instead of ibull-innovation.firebaseapp.com. That needs
// https://partner.gullysport.ibullinnovation.com/__/auth/handler added to the
// Google OAuth web client's redirect URIs first, or Google refuses the sign-in.
const OWN_AUTH_DOMAIN = false;
const SITE_HOST = "partner.gullysport.ibullinnovation.com";

const firebaseConfig = {
  apiKey: "AIzaSyCysnQJtK5FL2jFBUYU9fHSnLeEbIqVOG0",
  authDomain: OWN_AUTH_DOMAIN && location.hostname === SITE_HOST ? SITE_HOST : "ibull-innovation.firebaseapp.com",
  projectId: "ibull-innovation",
  storageBucket: "ibull-innovation.firebasestorage.app",
  messagingSenderId: "764942686486",
  appId: "1:764942686486:web:cbbf866b3ca89a059c5837",
  measurementId: "G-5F65Q600RN"
};

export const app = initializeApp(firebaseConfig);

// App Check — see the long note in website/js/firebase-init.js. Same site key
// as the other IBULL sites (one Firebase web app). Inert until the key is pasted,
// so this is safe to deploy beforehand.
const RECAPTCHA_ENTERPRISE_SITE_KEY = "6LcFtpUtAAAAAKnq-y8srkzHbmjMhYbNBhEZyse2";

// Inside the iOS/Android app, reCAPTCHA can't vouch for the page (it isn't
// served from our domain), so the token comes from the device instead: App
// Attest on iOS, Play Integrity on Android, via the @capacitor-firebase/app-check
// plugin. The web SDK still attaches it to every Firestore/Storage/Functions call.
let nativeAppCheckReady = null;
async function nativeAppCheckToken() {
  const { plugin } = await nativePlugin("FirebaseAppCheck");
  if (!plugin) throw new Error("FirebaseAppCheck plugin missing from this app build");
  nativeAppCheckReady ||= plugin.initialize({ isTokenAutoRefreshEnabled: true });
  await nativeAppCheckReady;
  const { token, expireTimeMillis } = await plugin.getToken();
  return { token, expireTimeMillis: expireTimeMillis || Date.now() + 30 * 60 * 1000 };
}

if (isNativeApp) {
  try {
    initializeAppCheck(app, {
      provider: new CustomProvider({ getToken: nativeAppCheckToken }),
      isTokenAutoRefreshEnabled: true
    });
  } catch (err) {
    console.error("App Check failed to initialize:", err);
  }
} else if (RECAPTCHA_ENTERPRISE_SITE_KEY && !RECAPTCHA_ENTERPRISE_SITE_KEY.startsWith("PASTE_")) {
  // reCAPTCHA is the heaviest thing on the page (its scripts and frame are
  // several hundred KB), and nobody can do anything protected in the first
  // seconds. So it starts after the page has drawn: on the first tap, key or
  // scroll, or when the browser is idle (4 s at the latest). Requests made
  // before then go without a token; App Check is not enforced on reads, and
  // every form, payment and upload comes after a tap, by which time it's on.
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    } catch (err) {
      console.error("App Check failed to initialize:", err);
    }
  };
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) addEventListener(ev, start, { once: true, passive: true, capture: true });
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 4000 }) : setTimeout(start, 3000));
  if (document.readyState === "complete") idle(); else addEventListener("load", idle, { once: true });
}

// In the app, skip the popup/redirect helper getAuth() loads: it needs an
// iframe from authDomain, which a WebView can hang on. Sign-in there is email or
// native phone verification (js/native-phone.js), neither of which uses it.
export const auth = isNativeApp
  ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
  : getAuth(app);

// GullySport has its own sign-in pool (Identity Platform tenant), separate from
// GullyReels: the same email is a different account on each platform (SH-45).
// Every sign-in, sign-up, password reset and phone verification on this site
// and in the app goes to this pool.
export const AUTH_TENANT = "GullySport-kp4uh";
auth.tenantId = AUTH_TENANT;
export const db = getFirestore(app);
