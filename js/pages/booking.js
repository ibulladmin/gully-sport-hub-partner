// Booking detail: contact the player, mark paid, confirm, cancel.
import { requirePartner } from "../session.js";
import { getBooking, setOfflinePayment, confirmRequest, cancelBooking } from "../data/bookings.js";
import { mountNav, esc, inr, timeLabel, dayLabel, toast } from "../ui.js";

mountNav();

requirePartner(async () => {
  const el = document.getElementById("booking");
  const id = new URLSearchParams(location.search).get("id");
  const b = id && await getBooking(id).catch(() => null);
  if (!b) { el.innerHTML = '<div class="empty-state">That booking doesn\'t exist or isn\'t yours.</div>'; return; }

  const offline = b.source && b.source !== "online";
  const phone = b.guestPhone || b.userPhone || "";
  const status = b.status || "pending";
  el.innerHTML = `
    <h1>${esc(b.guestName || b.userName || "Booking")} <span class="badge badge-${esc(status)}">${esc(status)}</span></h1>
    <p>${esc(b.facilityName || "")}${b.date ? ` · ${esc(dayLabel(b.date))}` : ""}${b.startTime ? `, ${esc(timeLabel(b.startTime))}` : ""}${b.hours ? ` for ${esc(b.hours)} h` : ""}</p>
    <p class="muted">${esc({ online: "Booked online", walk_in: "Walk-in", phone: "Phone booking", recurring: "Recurring booking" }[b.source || "online"] || "")}${b.amount ? ` · ${esc(inr(b.amount))}` : ""}</p>
    ${phone ? `<p><a class="btn btn-ghost" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">Call ${esc(phone)}</a></p>` : ""}
    ${offline ? `<label>Payment <select id="pay">${["unpaid", "cash", "upi"].map((p) => `<option value="${p}"${b.offlinePayment === p ? " selected" : ""}>${{ unpaid: "Not paid yet", cash: "Cash", upi: "UPI" }[p]}</option>`).join("")}</select></label>`
      : `<p>Payment: ${esc(b.paymentStatus || (b.amount ? "unpaid" : "no charge"))}</p>`}
    <div class="row-wrap">
      ${status === "pending" && !b.amount ? '<button class="btn btn-primary" id="confirm">Confirm request</button>' : ""}
      ${status !== "cancelled" ? '<button class="btn btn-ghost danger" id="cancel">Cancel booking</button>' : ""}
    </div>
    ${b.paymentStatus === "paid" ? '<p class="muted small">Paid online. Cancelling does not refund; refunds follow your cancellation policy and are handled by the IBULL team for now.</p>' : ""}`;

  el.querySelector("#pay")?.addEventListener("change", (e) => setOfflinePayment(id, e.target.value).then(() => toast("Saved."), (err) => toast(err.message)));
  el.querySelector("#confirm")?.addEventListener("click", () => confirmRequest(id).then(() => location.reload(), (err) => toast(err.message)));
  el.querySelector("#cancel")?.addEventListener("click", async () => {
    if (!confirm("Cancel this booking? The slot becomes free straight away.")) return;
    try { await cancelBooking(id); location.reload(); } catch (err) { toast(err.message); }
  });
});
