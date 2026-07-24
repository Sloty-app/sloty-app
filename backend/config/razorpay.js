// config/razorpay.js — Razorpay client setup, with the same dev-mode
// fallback pattern already used for WhatsApp/SMS in this app: if real
// credentials aren't configured yet, payments are simulated locally
// instead of failing outright, so the rest of the booking flow can be
// built and tested without needing live gateway access.
const hasRealCredentials = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

let razorpay = null;
if (hasRealCredentials) {
  const Razorpay = require("razorpay");
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log("✅ Razorpay initialized (live test/live keys detected)");
} else {
  console.log("⚠️  Razorpay running in DEV MODE — no real credentials found.");
  console.log("   Payments will be simulated locally. Add RAZORPAY_KEY_ID and");
  console.log("   RAZORPAY_KEY_SECRET to .env to use real Razorpay test mode.");
}

module.exports = { razorpay, hasRealCredentials };