// ===================== Hub Partner — Who is signed in =====================
//
// Every screen except login calls requirePartner(). A partner is a GullySport
// account with role "facility_owner" (set by partner signup), or an admin.
// Staff invited to a facility are found through facilities.staffIds instead,
// so a staff member's own role can stay "player".

import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let ready = null;

/** Resolves once with { user, profile } or null when signed out. */
export function currentUser() {
  ready ||= new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, async (user) => {
      stop();
      if (!user) return resolve(null);
      let profile = {};
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) profile = snap.data();
      } catch (err) {
        console.warn("Could not load profile:", err);
      }
      resolve({ user, profile });
    });
  });
  return ready;
}

/** Sends signed-out visitors to login, then calls `start(session)`. */
export async function requirePartner(start) {
  const s = await currentUser();
  if (!s) {
    sessionStorage.setItem("postLoginRedirect", location.pathname + location.search);
    location.replace("login.html");
    return;
  }
  if (s.profile.disabled) {
    document.body.innerHTML = '<main class="page"><div class="empty-state">This account is disabled. Contact gullysport@ibullinnovation.com.</div></main>';
    return;
  }
  s.isOwner = s.profile.role === "facility_owner" || s.profile.role === "admin";
  start(s);
}

export async function logOut() {
  await signOut(auth);
  location.replace("login.html");
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-logout]")) logOut();
});
