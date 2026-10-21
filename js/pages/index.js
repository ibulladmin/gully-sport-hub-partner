import { currentUser } from "../session.js";

currentUser().then((s) => location.replace(s ? "today.html" : "login.html"));
