import { auth } from "../firebase-init.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { currentUser } from "../session.js";

const next = () => {
  const to = sessionStorage.getItem("postLoginRedirect") || "today.html";
  sessionStorage.removeItem("postLoginRedirect");
  location.replace(to);
};

currentUser().then((s) => { if (s) next(); });

const form = document.getElementById("login-form");
const err = document.getElementById("auth-error");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.hidden = true;
  const btn = form.querySelector("button");
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
    next();
  } catch (e2) {
    err.textContent = /invalid|wrong|not-found/.test(e2.code || "") ? "That email and password don't match." : e2.message;
    err.hidden = false;
    btn.disabled = false;
  }
});
