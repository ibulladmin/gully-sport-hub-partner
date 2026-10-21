// The five-step registration wizard, also used to edit a facility.
// A draft is saved after every step, so a partner can stop and come back.
import { db } from "../firebase-init.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requirePartner } from "../session.js";
import { getFacility, createDraft, saveFacility, submitForReview, listCourts, saveCourt, deleteCourt } from "../data/facilities.js";
import { listMedia } from "../data/media.js";
import { WIZARD_STEPS, FACILITY_TYPES, AMENITIES, MAX_DESCRIPTION, basicsProblems, locationProblems, courtProblems } from "../core/facility.js";
import { SLOT_LENGTHS, WEEKDAYS } from "../core/slots.js";
import { countByKind, MIN_PHOTOS } from "../core/media.js";
import { mountNav, statusBadge, esc, toast } from "../ui.js";

mountNav();

const DAY_NAMES = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DEFAULT_HOURS = Object.fromEntries(WEEK.map((d) => [d, { open: "06:00", close: "22:00" }]));

requirePartner(async ({ user, profile }) => {
  const id = new URLSearchParams(location.search).get("id");
  let facility = id ? await getFacility(id) : { status: "draft", sports: ["Cricket"], amenities: [] };
  if (id && !facility) {
    document.getElementById("step").innerHTML = '<div class="empty-state">That facility doesn\'t exist or isn\'t yours.</div>';
    return;
  }
  let courts = id ? await listCourts(id) : [];
  let step = id ? 1 : 0;

  const stepEl = document.getElementById("step");
  const backBtn = document.getElementById("back");
  const nextBtn = document.getElementById("next");
  const errorBox = () => stepEl.querySelector(".step-errors");

  function header() {
    document.getElementById("title").innerHTML = facility.id ? `${esc(facility.name || "Facility")} ${statusBadge(facility.status)}` : "New facility";
    document.getElementById("steps").innerHTML = WIZARD_STEPS.map((s, i) =>
      `<li class="${i === step ? "on" : i < step ? "done" : ""}">${esc(s.label)}</li>`).join("");
    const note = document.getElementById("review-note");
    note.hidden = !(facility.status === "changes_requested" && facility.reviewNote);
    note.textContent = facility.reviewNote ? `From the IBULL team: ${facility.reviewNote}` : "";
    backBtn.hidden = step === 0;
    nextBtn.textContent = step === WIZARD_STEPS.length - 1 ? (facility.status === "draft" || facility.status === "changes_requested" ? "Submit for review" : "Done") : "Save and continue";
  }

  function showErrors(problems) {
    errorBox().innerHTML = problems.map((p) => `<li>${esc(p)}</li>`).join("");
    errorBox().hidden = !problems.length;
    return !problems.length;
  }

  // ---- Step renderers: each returns a save() that resolves false to stay put ----

  const steps = [
    function account() {
      stepEl.innerHTML = `
        <h2>Partner account</h2>
        <p class="muted">Signed in as ${esc(user.email || user.phoneNumber || "")}. Mobile verification arrives with the shared phone sign-in.</p>
        <label>Your name <input id="a-name" value="${esc(profile.name || "")}" maxlength="60" required></label>
        <label>Business name <input id="a-org" value="${esc(profile.orgName || "")}" maxlength="80"></label>
        <label>Mobile <input id="a-phone" type="tel" value="${esc(profile.phone || "")}" maxlength="15"></label>
        <label>GST number (optional) <input id="a-gst" value="${esc(profile.gstNumber || "")}" maxlength="15" pattern="[0-9A-Z]{15}"></label>
        <ul class="step-errors alert" hidden></ul>`;
      return async () => {
        const v = (k) => stepEl.querySelector(k).value.trim();
        if (!showErrors(v("#a-name") ? [] : ["Add your name."])) return false;
        const patch = { name: v("#a-name"), orgName: v("#a-org"), phone: v("#a-phone"), gstNumber: v("#a-gst").toUpperCase() };
        await updateDoc(doc(db, "users", user.uid), patch);
        Object.assign(profile, patch);
        return true;
      };
    },

    function basics() {
      const f = facility;
      stepEl.innerHTML = `
        <h2>Basics</h2>
        <label>Facility name <input id="b-name" value="${esc(f.name || "")}" maxlength="80" required></label>
        <label>Type <select id="b-type">${FACILITY_TYPES.map((t) => `<option${t === f.type ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Sports (comma separated) <input id="b-sports" value="${esc((f.sports || []).join(", "))}"></label>
        <label>Description <textarea id="b-desc" maxlength="${MAX_DESCRIPTION}" rows="4">${esc(f.description || "")}</textarea></label>
        <fieldset><legend>Amenities</legend><div class="chips">${AMENITIES.map(([k, label]) =>
          `<label class="chip"><input type="checkbox" value="${k}"${(f.amenities || []).includes(k) ? " checked" : ""}> ${esc(label)}</label>`).join("")}</div></fieldset>
        <ul class="step-errors alert" hidden></ul>`;
      return async () => {
        const changes = {
          name: stepEl.querySelector("#b-name").value.trim(),
          type: stepEl.querySelector("#b-type").value,
          sports: stepEl.querySelector("#b-sports").value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
          description: stepEl.querySelector("#b-desc").value.trim(),
          amenities: [...stepEl.querySelectorAll(".chips input:checked")].map((i) => i.value)
        };
        if (!showErrors(basicsProblems(changes))) return false;
        if (!facility.id) {
          const newId = await createDraft(user.uid, changes);
          facility = { ...facility, ...changes, id: newId, ownerId: user.uid };
          history.replaceState(null, "", `?id=${encodeURIComponent(newId)}`);
        } else {
          facility = await saveFacility(facility, changes);
        }
        return true;
      };
    },

    function location() {
      const f = facility, g = f.geo || {};
      stepEl.innerHTML = `
        <h2>Location</h2>
        <label>Address <textarea id="l-address" rows="2" maxlength="200">${esc(f.address || "")}</textarea></label>
        <label>City <input id="l-city" value="${esc(f.city || "")}" maxlength="40"></label>
        <p class="muted">The pin gives players distance and directions. A map picker comes next; for now use your current location while at the facility, or paste the coordinates from Google Maps.</p>
        <div class="row-wrap">
          <label>Latitude <input id="l-lat" type="number" step="any" value="${esc(g.lat ?? "")}"></label>
          <label>Longitude <input id="l-lng" type="number" step="any" value="${esc(g.lng ?? "")}"></label>
          <button type="button" class="btn btn-ghost" id="l-here">Use my location</button>
        </div>
        <ul class="step-errors alert" hidden></ul>`;
      stepEl.querySelector("#l-here").addEventListener("click", () => {
        navigator.geolocation?.getCurrentPosition(
          (p) => { stepEl.querySelector("#l-lat").value = p.coords.latitude.toFixed(6); stepEl.querySelector("#l-lng").value = p.coords.longitude.toFixed(6); },
          (e) => toast("Couldn't get your location: " + e.message),
          { enableHighAccuracy: true, timeout: 15000 });
      });
      return async () => {
        const changes = {
          address: stepEl.querySelector("#l-address").value.trim(),
          city: stepEl.querySelector("#l-city").value.trim(),
          geo: { lat: Number(stepEl.querySelector("#l-lat").value), lng: Number(stepEl.querySelector("#l-lng").value) }
        };
        if (!showErrors(locationProblems(changes))) return false;
        facility = await saveFacility(facility, changes);
        return true;
      };
    },

    function courtsStep() {
      const row = (c, i) => `
        <details class="court" data-i="${i}"${c.id ? "" : " open"}>
          <summary><b>${esc(c.name || "New court")}</b> <span class="muted">₹${esc(c.basePricePerHour ?? "")}/hr · ${esc(c.slotMinutes || 60)} min slots</span></summary>
          <div class="row-wrap">
            <label>Name <input class="c-name" value="${esc(c.name || "")}" maxlength="30" placeholder="Net 1"></label>
            <label>Surface <input class="c-surface" value="${esc(c.surface || "")}" maxlength="30" placeholder="Astroturf"></label>
            <label class="chip"><input type="checkbox" class="c-indoor"${c.indoor ? " checked" : ""}> Indoor</label>
            <label class="chip"><input type="checkbox" class="c-lit"${c.lit ? " checked" : ""}> Floodlit</label>
          </div>
          <div class="row-wrap">
            <label>Price per hour (₹) <input class="c-price" type="number" min="0" step="10" value="${esc(c.basePricePerHour ?? "")}"></label>
            <label>Slot length <select class="c-slot">${SLOT_LENGTHS.map((m) => `<option value="${m}"${(c.slotMinutes || 60) === m ? " selected" : ""}>${m} min</option>`).join("")}</select></label>
            <label>Min slots <input class="c-min" type="number" min="1" max="12" value="${esc(c.minSlots || 1)}"></label>
            <label>Max slots <input class="c-max" type="number" min="1" max="24" value="${esc(c.maxSlots || 4)}"></label>
          </div>
          <table class="hours"><tbody>${WEEK.map((d) => {
            const h = (c.weeklyHours || DEFAULT_HOURS)[d] || { closed: true };
            return `<tr data-day="${d}"><th>${DAY_NAMES[d]}</th>
              <td><label class="chip"><input type="checkbox" class="h-open"${h.closed ? "" : " checked"}> Open</label></td>
              <td><input type="time" class="h-from" value="${esc(h.open || "06:00")}" aria-label="${DAY_NAMES[d]} opens"></td>
              <td><input type="time" class="h-to" value="${esc(h.close === "24:00" ? "23:59" : h.close || "22:00")}" aria-label="${DAY_NAMES[d]} closes"></td></tr>`;
          }).join("")}</tbody></table>
          <fieldset><legend>Peak price (optional)</legend>
            <div class="row-wrap">
              <div class="chips">${WEEK.map((d) => `<label class="chip"><input type="checkbox" class="p-day" value="${d}"${(c.peakRules?.[0]?.days || []).includes(d) ? " checked" : ""}> ${DAY_NAMES[d]}</label>`).join("")}</div>
              <label>From <input type="time" class="p-from" value="${esc(c.peakRules?.[0]?.from || "")}"></label>
              <label>To <input type="time" class="p-to" value="${esc(c.peakRules?.[0]?.to || "")}"></label>
              <label>₹/hour <input type="number" class="p-price" min="0" step="10" value="${esc(c.peakRules?.[0]?.pricePerHour ?? "")}"></label>
            </div>
          </fieldset>
          <button type="button" class="btn btn-ghost danger c-remove">Remove court</button>
        </details>`;
      const draw = () => {
        stepEl.innerHTML = `<h2>Courts</h2>
          <p class="muted">Add each thing players book separately: "Net 1", "Net 2", "Main ground". Each has its own price and hours.</p>
          <div id="courts">${courts.map(row).join("")}</div>
          <button type="button" class="btn btn-ghost" id="add-court">Add a court</button>
          <ul class="step-errors alert" hidden></ul>`;
        stepEl.querySelector("#add-court").addEventListener("click", () => { read(); courts.push({ weeklyHours: DEFAULT_HOURS }); draw(); });
        stepEl.querySelectorAll(".c-remove").forEach((b) => b.addEventListener("click", async () => {
          read();
          const i = Number(b.closest(".court").dataset.i);
          const c = courts[i];
          if (c.id && !confirm(`Remove ${c.name}? Existing bookings on it stay.`)) return;
          if (c.id) await deleteCourt(facility.id, c.id);
          courts.splice(i, 1);
          draw();
        }));
      };
      // Pulls the form back into `courts` so redraws don't lose typing.
      const read = () => {
        stepEl.querySelectorAll(".court").forEach((el) => {
          const c = courts[Number(el.dataset.i)];
          const q = (s) => el.querySelector(s);
          const peakDays = [...el.querySelectorAll(".p-day:checked")].map((i) => i.value);
          Object.assign(c, {
            name: q(".c-name").value.trim(),
            surface: q(".c-surface").value.trim(),
            indoor: q(".c-indoor").checked,
            lit: q(".c-lit").checked,
            basePricePerHour: q(".c-price").value === "" ? null : Number(q(".c-price").value),
            slotMinutes: Number(q(".c-slot").value),
            minSlots: Number(q(".c-min").value) || 1,
            maxSlots: Number(q(".c-max").value) || 4,
            weeklyHours: Object.fromEntries([...el.querySelectorAll(".hours tr")].map((tr) => [tr.dataset.day,
              tr.querySelector(".h-open").checked
                ? { open: tr.querySelector(".h-from").value, close: tr.querySelector(".h-to").value === "23:59" ? "24:00" : tr.querySelector(".h-to").value }
                : { closed: true }])),
            peakRules: peakDays.length && q(".p-from").value && q(".p-to").value && q(".p-price").value !== ""
              ? [{ days: peakDays, from: q(".p-from").value, to: q(".p-to").value, pricePerHour: Number(q(".p-price").value) }]
              : []
          });
        });
      };
      if (!courts.length) courts.push({ weeklyHours: DEFAULT_HOURS });
      draw();
      return async () => {
        read();
        if (!showErrors(courtProblems(courts))) return false;
        for (const c of courts) c.id = await saveCourt(facility.id, c);
        return true;
      };
    },

    function mediaStep() {
      stepEl.innerHTML = '<h2>Photos and videos</h2><p class="muted">Loading…</p><ul class="step-errors alert" hidden></ul>';
      listMedia(facility.id).then((media) => {
        const n = countByKind(media);
        stepEl.querySelector("p").outerHTML = `
          <p>${n.photo} photo${n.photo === 1 ? "" : "s"}, ${n.video} clip${n.video === 1 ? "" : "s"}, ${n.link} link${n.link === 1 ? "" : "s"}.
          ${n.photo < MIN_PHOTOS ? `<b>Add at least ${MIN_PHOTOS} photos before submitting.</b>` : ""}</p>
          <a class="btn btn-ghost" href="media.html?id=${encodeURIComponent(facility.id)}">Manage photos and videos</a>
          <p class="muted">Opening hours and slot length are set per court in the previous step.</p>`;
      });
      return async () => {
        if (facility.status !== "draft" && facility.status !== "changes_requested") return true;
        const problems = await submitForReview(facility);
        if (!showErrors(problems)) return false;
        facility.status = "in_review";
        toast("Submitted. The IBULL team will review your facility shortly.");
        setTimeout(() => window.location.assign("facilities.html"), 1200);
        return false;
      };
    }
  ];

  let save = null;
  function render() {
    header();
    save = steps[step]();
  }

  nextBtn.addEventListener("click", async () => {
    nextBtn.disabled = true;
    try {
      if (await save()) {
        if (step < steps.length - 1) step++;
        else window.location.assign("facilities.html");
        render();
        scrollTo(0, 0);
      }
    } catch (err) {
      toast("Could not save: " + err.message);
    } finally {
      nextBtn.disabled = false;
    }
  });
  backBtn.addEventListener("click", () => { if (step > 0) { step--; render(); } });

  render();
});
