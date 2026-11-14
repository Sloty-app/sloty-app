// controllers/paymentController.js
//
// Design note: this deliberately does NOT touch the existing booking
// creation logic in bookingController.js (which already has carefully
// tested atomic slot-capacity + wallet transaction handling). A
// booking created with paymentMode:"upi" already defaults to
// paymentStatus:"pending" (existing schema behavior, unchanged) —
// payment is verified as a SEPARATE step afterward that just flips
// paymentStatus to "paid", the same way cash bookings already get
// marked "paid" when an owner marks them completed. Two concerns
// stay cleanly separated, minimizing risk to already-working code.
const crypto = require("crypto");
const Booking = require("../models/Booking");
const Store = require("../models/Store");
const User = require("../models/User");
const { razorpay, hasRealCredentials, devPaymentsAllowed } = require("../config/razorpay");

// Credits the store's pending settlement balance once a UPI payment is
// genuinely verified — this is the ledger entry that later shows up
// as "available to settle" on the owner's side.
async function creditStoreBalance(storeId, amount) {
  await Store.findByIdAndUpdate(storeId, { $inc: { pendingUpiBalance: amount } });
}

// Flips a verified booking to paid exactly once. The old code saved and
// credited the store on every call, so re-sending the same (valid)
// verification credited the store's payout balance again each time.
// A booking cancelled before the payment landed (e.g. the abandoned-
// payment job ran first) keeps its cancellation and the money goes back
// to the customer's wallet instead of to the store.
// Shared by the browser's verify call and Razorpay's webhook, whichever
// arrives first; the other then finds the booking already paid.
async function applyPayment(booking, paymentId) {
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, paymentStatus: { $ne: "paid" }, razorpayOrderId: booking.razorpayOrderId },
    { paymentStatus: "paid", razorpayPaymentId: paymentId },
    { new: true }
  );
  if (!claimed) return { outcome: "already_paid", booking: await Booking.findById(booking._id) };
  if (claimed.status === "cancelled") {
    const upiAmount = Math.max(0, (claimed.service?.price || 0) - (claimed.walletDeducted || 0));
    await User.findByIdAndUpdate(claimed.customer, { $inc: { walletBalance: upiAmount } });
    claimed.refundStatus = "refunded_to_wallet";
    claimed.refundAmount = (claimed.refundAmount || 0) + upiAmount;
    await claimed.save({ validateBeforeSave:false });
    return { outcome: "refunded", booking: claimed };
  }
  await creditStoreBalance(claimed.store, claimed.service.price);
  return { outcome: "paid", booking: claimed };
}

async function markPaid(res, booking, paymentId, message) {
  const { outcome, booking: updated } = await applyPayment(booking, paymentId);
  const text = outcome === "already_paid" ? "Payment already verified"
    : outcome === "refunded" ? "This booking had already been cancelled, so your payment was added to your Sloty wallet."
    : message;
  return res.status(200).json({ success:true, message: text, booking: updated });
}

// UPI must be switched on by an admin before anyone can pay online —
// checked here as well as in the app, which only hides the option.
async function upiEnabled() {
  return !!(await require("../models/Settings").getSettings()).upiPaymentsEnabled;
}
exports.upiEnabled = upiEnabled;

// POST /api/payments/create-order  { bookingId }
exports.createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success:false, message:"bookingId is required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ success:false, message:"Not authorized for this booking" });
    }
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ success:false, message:"This booking is already paid for" });
    }
    if (booking.status !== "confirmed") {
      return res.status(400).json({ success:false, message:`This booking is ${booking.status.replace("_", " ")} — nothing to pay.` });
    }

    // Only what the wallet didn't cover — charging the full price on top
    // of the wallet deduction made the customer pay that part twice.
    const amountInPaise = Math.round((booking.service.price - (booking.walletDeducted || 0)) * 100);
    if (amountInPaise <= 0) return res.status(400).json({ success:false, message:"Nothing left to pay on this booking" });

    if (!(await upiEnabled())) {
      return res.status(400).json({ success:false, message:"Online payment isn't available right now. Please choose Pay at Store." });
    }

    // Missing Razorpay keys may only fall back to the simulated flow
    // below on an explicit development server — it marks any UPI booking
    // as paid (and credits the store) without money ever moving.
    if (!hasRealCredentials && !devPaymentsAllowed) {
      console.error("RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing — online payments are disabled.");
      return res.status(503).json({ success:false, message:"Online payment isn't available right now. Please choose Pay at Store." });
    }

    if (!hasRealCredentials) {
      // DEV MODE — no real Razorpay account connected yet. Return a
      // fake order so the frontend can still exercise the full flow;
      // verifyPayment below auto-approves anything with a "dev_" order id.
      const fakeOrderId = `dev_order_${bookingId}_${Date.now()}`;
      booking.razorpayOrderId = fakeOrderId;
      await booking.save({ validateBeforeSave:false });
      return res.status(200).json({
        success: true,
        devMode: true,
        order: { id: fakeOrderId, amount: amountInPaise, currency: "INR" },
        keyId: null,
      });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `booking_${bookingId}`,
    });

    booking.razorpayOrderId = order.id;
    await booking.save({ validateBeforeSave:false });

    res.status(200).json({
      success: true,
      devMode: false,
      order,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("createOrder error:", err.message);
    res.status(500).json({ success:false, message:"Could not start payment. Please try again." });
  }
};

// POST /api/payments/verify  { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
exports.verifyPayment = async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!bookingId || !razorpay_order_id) {
      return res.status(400).json({ success:false, message:"Missing payment details" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ success:false, message:"Not authorized for this booking" });
    }
    if (booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success:false, message:"Order mismatch — payment does not match this booking" });
    }

    if (!hasRealCredentials && !devPaymentsAllowed) {
      return res.status(503).json({ success:false, message:"Online payment isn't available right now." });
    }
    if (!hasRealCredentials) {
      // DEV MODE — trust it, since this is only reachable with a
      // dev_order_ id that createOrder itself generated above; there's
      // no real gateway to verify against yet.
      return markPaid(res, booking, `dev_payment_${Date.now()}`, "Payment verified (dev mode)");
    }

    // REAL MODE — the critical security step. Never trust the frontend's
    // claim that payment succeeded; independently recompute the expected
    // signature and compare. This is the only way to be sure the payment
    // genuinely happened and wasn't faked by someone tampering with the
    // browser request.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // Constant-time comparison — a plain !== leaks how many leading
    // bytes matched via response-timing differences, which (however
    // impractical in this instance) is exactly the class of bug you
    // don't want on a payment-verifying comparison. Length is checked
    // first since timingSafeEqual throws on mismatched buffer lengths
    // rather than just returning false.
    const signaturesMatch = typeof razorpay_signature === "string"
      && razorpay_signature.length === expectedSignature.length
      && crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));
    if (!signaturesMatch) {
      return res.status(400).json({ success:false, message:"Payment verification failed — signature mismatch" });
    }

    return markPaid(res, booking, razorpay_payment_id, "Payment verified");
  } catch (err) {
    console.error("verifyPayment error:", err.message);
    res.status(500).json({ success:false, message:"Could not verify payment. Please contact support if money was deducted." });
  }
};

// PUT /api/payments/switch-to-cash  { bookingId }
// Lets a customer back out of the UPI payment screen without losing
// their slot — the booking stays reserved (same atomic capacity as
// any booking), just switches to being paid at the store instead.
// Only valid for bookings that never actually completed payment; a
// booking already marked "paid" can't be switched away from after the
// fact through this endpoint.
exports.switchToCash = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success:false, message:"bookingId is required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ success:false, message:"Not authorized for this booking" });
    }
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ success:false, message:"This booking is already paid — can't switch to cash" });
    }

    booking.paymentMode = "cash";
    booking.paymentStatus = "pending"; // unchanged value, but explicit — matches how cash bookings already behave until the owner marks them completed
    await booking.save({ validateBeforeSave:false });

    res.status(200).json({ success:true, message:"Switched to pay-at-store", booking });
  } catch (err) {
    console.error("switchToCash error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/payments/webhook — Razorpay calls this server-to-server when a
// payment is captured, so a payment still counts if the customer closed the
// app before the browser could call /verify. Needs the raw body (mounted
// before express.json in server.js) and RAZORPAY_WEBHOOK_SECRET, the secret
// set on the webhook in the Razorpay dashboard.
exports.razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ success:false, message:"Webhook not configured" });

    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const signature = String(req.get("X-Razorpay-Signature") || "");
    const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) return res.status(400).json({ success:false, message:"Invalid signature" });

    const event = JSON.parse(raw.toString("utf8"));
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id || event.payload?.order?.entity?.id;
      const booking = orderId ? await Booking.findOne({ razorpayOrderId: orderId }) : null;
      if (booking) {
        const due = Math.round(((booking.service?.price || 0) - (booking.walletDeducted || 0)) * 100);
        if (payment && payment.amount !== due) {
          console.error(`Razorpay webhook: amount ${payment.amount} doesn't match ₹${due / 100} due on booking ${booking._id}; not marking paid.`);
        } else {
          await applyPayment(booking, payment?.id || "");
        }
      }
    }
    // Always 200 for a correctly signed event, or Razorpay keeps retrying.
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("razorpayWebhook error:", err.message);
    res.status(500).json({ success:false });
  }
};
