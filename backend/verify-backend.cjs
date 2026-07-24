// verify-backend.cjs — comprehensive pre-launch check, rebuilt to
// cover everything added across this whole build (core features,
// payments, settlements, analytics). Run from the backend/ folder:
//   node verify-backend.cjs

const fs = require("fs");

let pass = 0, fail = 0;
const failures = [];

function check(label, condition, fixHint) {
  if (condition) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}`); fail++; failures.push({ label, fixHint }); }
}
function readSafe(path) { try { return fs.readFileSync(path, "utf8"); } catch { return null; } }
function fileExists(path) { return fs.existsSync(path); }
// Captures a full function body from "exports.name" up to the NEXT
// "exports." declaration (or end of file) — unlike a fixed character
// window, this can't cut off before reaching code that's just further
// down in a long function, which caused real false positives earlier.
function captureFunction(content, fnName) {
  const startIdx = content.indexOf(`exports.${fnName}`);
  if (startIdx === -1) return "";
  const nextExportIdx = content.indexOf("exports.", startIdx + fnName.length + 8);
  return nextExportIdx === -1 ? content.slice(startIdx) : content.slice(startIdx, nextExportIdx);
}

console.log("\n=== SERVER.JS — route registration ===");
const server = readSafe("server.js");
if (server) {
  ["auth","stores","bookings","notifications","support","chat","referral","assistant",
   "offers","payments","settlements","analytics"].forEach(route => {
    check(`Route registered: /api/${route}`, server.includes(`"/api/${route}"`), `Add: app.use("/api/${route}", require("./routes/${route}"));`);
  });
  check("DNS fix present (Atlas connection stability)", server.includes("dns") && (server.includes("setServers") || server.includes("setDefaultResultOrder")));
  check("No-show job registered", server.includes("runNoShowCheck"));
  check("Reminder job registered", server.includes("runReminderCheck"));
  check("Revisit job registered", server.includes("runRevisitCheck"));
  check("Abandoned UPI payment cleanup job registered", server.includes("runAbandonedPaymentCleanup"), "Without this, a customer abandoning the payment screen leaves that slot permanently locked for everyone else");
} else { console.log("  ❌ server.js not found!"); fail++; }

const reminderJob = readSafe("config/reminderJob.js");
if (reminderJob) {
  check("reminderJob: WhatsApp reminder wired in", reminderJob.includes("sendBookingReminderWhatsApp"), "Infrastructure existed but was never actually called — reminders were push-only");
  check("reminderJob: populates customer for phone/name", reminderJob.includes('.populate("customer"'));
} else { console.log("  ❌ config/reminderJob.js not found!"); fail++; }

console.log("\n=== CONFIG FILES ===");
check("config/socket.js exists", fileExists("config/socket.js"));
check("config/whatsapp.js exists", fileExists("config/whatsapp.js"));
check("config/notify.js exists", fileExists("config/notify.js"));
check("config/razorpay.js exists (payments)", fileExists("config/razorpay.js"));
check("config/db.js removed (dead code)", !fileExists("config/db.js"));
const notify = readSafe("config/notify.js");
if (notify) {
  check("notify.js: category-based preference check present", notify.includes("notifPrefs"), "Notification preferences won't be respected without this");
}

console.log("\n=== MODELS ===");
const booking = readSafe("models/Booking.js");
if (booking) {
  ["serviceBreakdown","recurrenceDays","walletDeducted","offerApplied",
   "paymentMode","paymentStatus","razorpayOrderId","razorpayPaymentId"].forEach(f => {
    check(`Booking: ${f} field declared`, booking.includes(f));
  });
}
const store = readSafe("models/Store.js");
if (store) {
  ["slotCapacity","isActive","removedAt","removedBy","pendingUpiBalance"].forEach(f => {
    check(`Store: ${f} field declared`, store.includes(f));
  });
  check("Store: ServiceSchema has recurrenceDays", (store.match(/ServiceSchema = new mongoose\.Schema\(\{[\s\S]*?\}\)/)||[""])[0].includes("recurrenceDays"), "Owner-set revisit reminders need this on each service, not just the top-level Store");
}
const user = readSafe("models/User.js");
if (user) {
  ["noShowCount","bookingRestrictedUntil","referralCode","walletBalance","googleId","notifPrefs","savedAddresses"].forEach(f => {
    check(`User: ${f} field declared`, user.includes(f));
  });
  check("User: referralCode is sparse (prevents empty-string collision bug)", (user.match(/referralCode:\s*\{[^}]*\}/)||[""])[0].includes("sparse"));
}
check("models/SlotCapacity.js exists", fileExists("models/SlotCapacity.js"));
check("models/Offer.js exists", fileExists("models/Offer.js"));
check("models/Conversation.js exists", fileExists("models/Conversation.js"));
check("models/Settlement.js exists", fileExists("models/Settlement.js"));

console.log("\n=== AUTH CONTROLLER (heavily patched this session) ===");
const auth = readSafe("controllers/authController.js");
if (auth) {
  check("generateReferralCode wired into register", auth.includes("generateReferralCode"));
  const updateProfileFn = captureFunction(auth, "updateProfile");
  check("updateProfile: destructures email", updateProfileFn.includes("email"));
  check("updateProfile: destructures phone", updateProfileFn.includes("phone"));
  check("updateProfile: destructures notifPrefs (correct casing)", /const\s*\{[^}]*notifPrefs[^}]*\}\s*=\s*req\.body/.test(updateProfileFn), "Must be camelCase notifPrefs, not notifprefs — case mismatch crashes every call");
  check("updateProfile: destructures savedAddresses (correct casing)", /const\s*\{[^}]*savedAddresses[^}]*\}\s*=\s*req\.body/.test(updateProfileFn), "Must be camelCase savedAddresses, not savedaddresses");
  check("updateProfile: handles duplicate-key errors specifically", updateProfileFn.includes("11000"));
  const verifyOtpFn = captureFunction(auth, "verifyOtpLogin");
  check("verifyOtpLogin: sets referralCode on new account creation", verifyOtpFn.includes("referralCode"), "Missing this causes EVERY registration after the first to fail with a misleading 'already registered' error");
  check("googleAuth: no dead OAuth2Client import", !(readSafe("controllers/googleAuth.js")||"").includes("OAuth2Client"));
  check("googleAuth: referralSystem import path correct (../utils/)", !(readSafe("controllers/googleAuth.js")||"").includes('require("./referralSystem")'));
  check("deleteAccount function present", auth.includes("exports.deleteAccount"));
}

console.log("\n=== PAYMENT + SETTLEMENT CONTROLLERS ===");
const payment = readSafe("controllers/paymentController.js");
if (payment) {
  check("paymentController: createOrder present", payment.includes("exports.createOrder"));
  check("paymentController: verifyPayment present", payment.includes("exports.verifyPayment"));
  check("paymentController: switchToCash present", payment.includes("exports.switchToCash"), "Without this, the 'pay at store instead' cancel button doesn't actually work");
  check("paymentController: signature verification present (real mode security)", payment.includes("createHmac"));
  check("paymentController: credits store balance on success", payment.includes("pendingUpiBalance") || payment.includes("creditStoreBalance"));
} else { console.log("  ❌ controllers/paymentController.js not found!"); fail++; }

const settlement = readSafe("controllers/settlementController.js");
if (settlement) {
  ["getMyBalance","requestSettlement","getPendingSettlements","completeSettlement"].forEach(fn => {
    check(`settlementController: ${fn} present`, settlement.includes(`exports.${fn}`));
  });
}
check("controllers/analyticsController.js exists", fileExists("controllers/analyticsController.js"));

console.log("\n=== OTHER CONTROLLERS (unchanged this session, still checked) ===");
const bookingCtrl = readSafe("controllers/bookingController.js");
if (bookingCtrl) {
  check("bookingController: mongoose transactions present", bookingCtrl.includes("startTransaction"));
  check("bookingController: SlotCapacity used", bookingCtrl.includes("SlotCapacity"));
  check("bookingController: offer discount computation present", bookingCtrl.includes("computeOfferDiscount"));
}
check("controllers/referralController.js exists", fileExists("controllers/referralController.js"));
check("controllers/offerController.js exists", fileExists("controllers/offerController.js"));
check("controllers/chatController.js exists", fileExists("controllers/chatController.js"));
const chatCtrl = readSafe("controllers/chatController.js");
if (chatCtrl) {
  check("chatController: customer message notification respects 'chat' preference", (chatCtrl.match(/sendNotification\(store\.owner[\s\S]{0,150}/)||[""])[0].includes('"chat"'));
  check("chatController: owner reply notification respects 'chat' preference", (chatCtrl.match(/sendNotification\(convo\.customer[\s\S]{0,150}/)||[""])[0].includes('"chat"'));
}
const offerCtrlCheck = readSafe("controllers/offerController.js");
if (offerCtrlCheck) {
  check("offerController: fan-out notification respects 'offers' preference", (offerCtrlCheck.match(/sendNotification\(\s*c\._id[\s\S]{0,200}/)||[""])[0].includes('"offers"'));
}
check("controllers/storeController.js exists", fileExists("controllers/storeController.js"));

console.log("\n=== ROUTES ===");
["chat","referral","assistant","offers","stores","support","bookings","auth",
 "notifications","payments","settlements","analytics"].forEach(r => {
  check(`routes/${r}.js exists`, fileExists(`routes/${r}.js`));
});
const paymentRoutes = readSafe("routes/payments.js");
if (paymentRoutes) {
  check("payments.js: switch-to-cash route registered", paymentRoutes.includes("switch-to-cash"));
}
const offerRoutes = readSafe("routes/offers.js");
if (offerRoutes) {
  const batchIdx = offerRoutes.indexOf('"/batch"');
  const idIdx = offerRoutes.indexOf("/:id");
  check("offers.js: /batch route before /:id", batchIdx !== -1 && (idIdx === -1 || batchIdx < idIdx));
}

console.log("\n=== Settings toggle system (referral pause, UPI hide) ===");
const settingsModel = readSafe("models/Settings.js");
check("models/Settings.js exists", !!settingsModel);
if (settingsModel) {
  check("Settings: referralProgramEnabled field present", settingsModel.includes("referralProgramEnabled"));
  check("Settings: upiPaymentsEnabled field present", settingsModel.includes("upiPaymentsEnabled"));
}
const settingsCtrl = readSafe("controllers/settingsController.js");
check("controllers/settingsController.js exists", !!settingsCtrl);
if (settingsCtrl) {
  check("settingsController: exports getPublicSettings", settingsCtrl.includes("exports.getPublicSettings"));
  check("settingsController: exports setReferralProgramEnabled", settingsCtrl.includes("exports.setReferralProgramEnabled"));
  check("settingsController: exports setUpiPaymentsEnabled", settingsCtrl.includes("exports.setUpiPaymentsEnabled"));
}
check("routes/settings.js exists", fileExists("routes/settings.js"));
check("server.js: /api/settings route registered", (readSafe("server.js")||"").includes('"/api/settings"'));

console.log("\n=== Owner phone login + role-separated accounts ===");
const userModel = readSafe("models/User.js");
if (userModel) {
  check("User: phone field is NOT globally unique (must allow one per role)", !/phone:\s*\{[^}]*unique:\s*true/.test(userModel), "Owners and customers on the same phone number would collide otherwise");
  check("User: compound (phone, role) index present", userModel.includes("phone: 1, role: 1"));
  check("User: compound (phone, role) index is sparse", /phone:\s*1,\s*role:\s*1[\s\S]{0,60}sparse:\s*true/.test(userModel), "Without sparse, multiple Google-only accounts (phone:null) of the same role would collide");
  check("User: email field is NOT globally unique (must allow one per role)", !/email:\s*\{[^}]*unique:\s*true/.test(userModel));
  check("User: compound (email, role) index present", userModel.includes("email: 1, role: 1"));
  check("User: phone is not schema-required (Google-only accounts have phone:null)", !/phone:\s*\{[^}]*required:\s*\[?true/.test(userModel));
}
const authCtrl = readSafe("controllers/authController.js");
if (authCtrl) {
  check("authController: sendOtp accepts role parameter", /sendOtp[\s\S]{0,600}req\.body\.role/.test(authCtrl));
  check("authController: verifyOtpLogin accepts role parameter", /verifyOtpLogin[\s\S]{0,300}req\.body\.role/.test(authCtrl));
  check("authController: verifyOtpLogin scopes lookup by (phone, role)", authCtrl.includes("findOne({ phone, role })"));
}
const googleAuthCtrl = readSafe("controllers/googleAuth.js");
if (googleAuthCtrl) {
  check("googleAuth: role-aware (not hardcoded to customer)", !googleAuthCtrl.includes('role: "customer",') || googleAuthCtrl.includes("req.body.role"));
  check("googleAuth: scopes lookup by (email, role)", googleAuthCtrl.includes("findOne({ email, role })"));
}

console.log("\n=== Variable pricing (\"On Inspection\" services) ===");
const storeModel = readSafe("models/Store.js");
if (storeModel) {
  check("Store: isPriceVariable field on ServiceSchema", storeModel.includes("isPriceVariable"));
  check("Store: price is conditionally required (not required when variable)", /price:\s*\{[^}]*required:\s*function/.test(storeModel));
  check("Store: unisex_salon in category enum", storeModel.includes('"unisex_salon"'));
}
const bookingCtrl2 = readSafe("controllers/bookingController.js");
if (bookingCtrl2) {
  check("bookingController: blocks UPI when a variable-priced service is selected", bookingCtrl2.includes("hasVariablePriceService"));
  check("bookingController: rescheduleBooking exists", bookingCtrl2.includes("exports.rescheduleBooking"));
  check("bookingController: blocked-dates functions exist", bookingCtrl2.includes("exports.getBlockedDates") && bookingCtrl2.includes("exports.addBlockedDate"));
  check("bookingController: cancellation refund policy present", bookingCtrl2.includes("REFUND_NOTICE_HOURS"));
}

console.log("\n=== Security hardening (mongo-sanitize, CSP) ===");
const serverJs = readSafe("server.js");
if (serverJs) {
  check("server.js: express-mongo-sanitize in use", serverJs.includes("mongoSanitize") || serverJs.includes("express-mongo-sanitize"), "NoSQL injection protection — npm install express-mongo-sanitize if missing");
  check("server.js: explicit Content-Security-Policy configured", serverJs.includes("contentSecurityPolicy"));
  check("server.js: production error handler doesn't leak raw error messages", serverJs.includes('NODE_ENV === "development"') && /app\.use\(\(err, req, res, next\)/.test(serverJs));
}

console.log("\n=== AI assistant category coverage ===");
const assistantCtrl = readSafe("controllers/assistantController.js");
if (assistantCtrl) {
  check("assistantController: category enum includes unisex_salon", assistantCtrl.includes("unisex_salon"), "Without this, the AI assistant can't correctly filter/search for this category");
}

console.log("\n=== ONE-OFF SCRIPTS CLEANUP ===");
const scriptFiles = fs.readdirSync(".").filter(f => f.startsWith("fix-") || f.startsWith("add-") || f.startsWith("check-") || f.startsWith("diagnose-") || f.startsWith("find-") || f.startsWith("backfill-") || f.startsWith("improve-") || f.startsWith("remove-") || f === "verify-backend-old.cjs");
check("No leftover one-off fix/migration scripts in backend root", scriptFiles.length === 0, `Found: ${scriptFiles.join(", ")} — delete these before release`);

console.log("\n=== .env.example ===");
const envExample = readSafe(".env.example");
if (envExample) {
  ["GEMINI_API_KEY","GOOGLE_CLIENT_ID","MSG91_AUTH_KEY","WHATSAPP_ACCESS_TOKEN","RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET"].forEach(key => {
    check(`.env.example documents ${key}`, envExample.includes(key));
  });
}

console.log("\n" + "=".repeat(50));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(50));
if (failures.length > 0) {
  console.log("\n--- ACTION NEEDED ---");
  failures.forEach(f => { console.log(`\n❌ ${f.label}`); if (f.fixHint) console.log(`   Fix: ${f.fixHint}`); });
}
