// web-common v1.1.0 (ibull-functions 771de24). DO NOT EDIT HERE —
// change ibull-functions/web-common, tag a release, then re-run tools/vendor.mjs.
// ===================== web-common — Razorpay checkout =====================
//
// The browser's job in a payment is deliberately small: say WHAT is being bought,
// open the sheet, and report back. It never says what it costs. createPaymentOrder
// (ibull-functions) loads the item from Firestore and prices it there, so editing
// anything in this file — or in devtools — cannot change what someone is charged.
//
// No Firebase imports: each site passes its own callables and signed-in user.
//
//   const { payFor } = createCheckout({
//     createPaymentOrder, confirmPayment,     // httpsCallable(functions, "…") in asia-south1
//     currentUser: () => auth.currentUser,
//     brandName: "GullySport", themeColor: "#F2740B"
//   });
//   const out = await payFor({ type: "tournament_entry", payload: {...}, prefill: {...} });
//
// Three outcomes, and callers must handle all three:
//
//   "fulfilled"  paid (or free) and the record exists
//   "cancelled"  user closed the sheet — nothing was charged, nothing was created
//   "pending"    money taken but confirmation didn't complete in the browser
//
// "pending" is the one people forget. It is not an error and must NOT be shown
// as one: the webhook will fulfil it server-side within seconds. Telling someone
// their payment failed when it succeeded is how you get a support queue.

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let checkoutLoader = null;

/** Load checkout.js once, lazily. Cached as a promise so parallel calls share it. */
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutLoader) return checkoutLoader;

  checkoutLoader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever —
      // this is usually a dropped connection, not a permanent state.
      checkoutLoader = null;
      reject(new Error("Could not reach Razorpay. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return checkoutLoader;
}

/** Callable errors arrive wrapped; dig out the message we actually wrote. */
function readableError(err) {
  const msg = err?.message || "";
  if (/internal/i.test(err?.code || "") || !msg) {
    return "Something went wrong taking the payment. Nothing has been charged.";
  }
  return msg;
}

/**
 * @param {object}   deps
 * @param {Function} deps.createPaymentOrder  callable: ({type, payload}) -> {data: order}
 * @param {Function} deps.confirmPayment      callable: ({paymentId, razorpayPaymentId, orderId, signature}) -> {data}
 * @param {Function} deps.currentUser         () -> the signed-in Firebase user, or null
 * @param {string}   deps.brandName           shown on the Razorpay sheet
 * @param {string}   deps.themeColor          sheet accent colour
 * @returns {{ payFor: Function }}
 */
export function createCheckout({ createPaymentOrder, confirmPayment, currentUser, brandName, themeColor }) {
  return { payFor };

  /**
   * @param {object}  opts
   * @param {string}  opts.type     catalog key, e.g. "tournament_entry"
   * @param {object}  opts.payload  what is being bought (ids and form data — never a price)
   * @param {object} [opts.prefill] { name, email, contact } to pre-fill the sheet
   * @returns {Promise<{status:"fulfilled"|"cancelled"|"pending", paymentId?:string, id?:string, amountInr?:number, message?:string}>}
   */
  async function payFor({ type, payload, prefill = {} }) {
    const user = currentUser();
    if (!user) throw new Error("Please sign in first.");

    // 1. Price it and open an order, server-side.
    let order;
    try {
      order = (await createPaymentOrder({ type, payload })).data;
    } catch (err) {
      throw new Error(readableError(err));
    }

    // 2. Free entries never open the sheet — they are already done.
    if (order.free) {
      return { status: "fulfilled", paymentId: order.paymentId, id: order.fulfilledId, amountInr: 0 };
    }

    await loadCheckout();

    // 3. Open the sheet and wait for the user.
    return new Promise((resolve, reject) => {
      // Razorpay calls neither handler if the user just navigates away, so this
      // promise can legitimately never settle. That is fine — the page is gone.
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const fail = (e) => { if (!settled) { settled = true; reject(e); } };

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: "INR",
        name: brandName,
        description: order.description,
        prefill: {
          name: prefill.name || user.displayName || "",
          email: prefill.email || user.email || "",
          contact: prefill.contact || ""
        },
        notes: { paymentId: order.paymentId },
        theme: { color: themeColor },

        modal: {
          ondismiss: () => done({
            status: "cancelled",
            paymentId: order.paymentId,
            message: "Payment cancelled — you have not been charged."
          })
        },

        handler: async (response) => {
          try {
            const out = (await confirmPayment({
              paymentId: order.paymentId,
              razorpayPaymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature
            })).data;

            done({
              status: "fulfilled",
              paymentId: order.paymentId,
              id: out.id,
              amountInr: order.amountInr
            });
          } catch (err) {
            // The money is real — confirmation is what failed. The webhook will
            // finish this server-side, so this is "pending", never "failed".
            console.error("confirmPayment failed; webhook will reconcile:", err);
            done({
              status: "pending",
              paymentId: order.paymentId,
              amountInr: order.amountInr,
              message:
                "Your payment went through, but we couldn't finish confirming it here. " +
                "It'll appear on your dashboard within a minute — don't pay again."
            });
          }
        }
      });

      rzp.on("payment.failed", (resp) => {
        fail(new Error(resp?.error?.description || "The payment was declined. Nothing has been charged."));
      });

      try {
        rzp.open();
      } catch (err) {
        fail(new Error("Could not open the payment window: " + err.message));
      }
    });
  }
}
