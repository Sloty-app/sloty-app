// verify-frontend.cjs — rebuilt comprehensively for everything added
// across this whole build. Run from the frontend/ folder:
//   node verify-frontend.cjs

const fs = require("fs");

let pass = 0, fail = 0;
const failures = [];

function check(label, condition, fixHint) {
  if (condition) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}`); fail++; failures.push({ label, fixHint }); }
}
function readSafe(path) { try { return fs.readFileSync(path, "utf8"); } catch { return null; } }
function fileExists(path) { return fs.existsSync(path); }

console.log("\n=== CustomerApp.jsx ===");
const cust = readSafe("src/pages/customer/CustomerApp.jsx");
if (cust) {
  check("Chat: CustomerChatModal imported", cust.includes('import CustomerChatModal'));
  check("Referral: ReferralScreen imported", cust.includes('import ReferralScreen'));
  check("Search: SEARCH_SYNONYMS table present", cust.includes("SEARCH_SYNONYMS"));
  check("Search: filtStores checks service names too", cust.includes("services||[]).some"));
  check("Profile completion gate present", cust.includes("needsProfileCompletion"));
  check("Profile completion: placeholder-email detection present", cust.includes("hasPlaceholderEmail"));
  check("Settings: Change Password removed (not used — OTP auth)", !cust.includes("changePassword") && !cust.includes("Change Password"), "This was deliberately removed since customers never use a password to log in");
  check("Settings: Notification Preferences present", cust.includes("notifPrefs") || cust.includes("Notification Preferences"));
  check("Settings: Saved Addresses present", cust.includes("Saved Addresses") || cust.includes("savedAddresses"));
  check("Settings: Delete Account present", cust.includes("deleteAccount") || cust.includes("Delete Account"));
  check("Back-gesture history sync present", cust.includes("isPoppingRef") && cust.includes("popstate"));
  check("Back-gesture sync includes legalOverlay (Terms/Privacy)", cust.includes("legalOverlay"));
  check("Photo viewer: swipe gesture support present", cust.includes("swipeStartXRef"));
  check("Payments: paymentMethod choice present", cust.includes("paymentMethod") && cust.includes('"upi"'));
  check("Payments: pendingPayment / completePayment flow present", cust.includes("pendingPayment") && cust.includes("completePayment"));
  check("Payments: switchPendingBookingToCash present (cancel button actually works)", cust.includes("switchPendingBookingToCash"), "Without this, the UPI payment 'cancel, pay at store instead' button doesn't do what it says");
  check("Payments: UPI status badge on own bookings", cust.includes("Paid via UPI"));
} else { console.log("  ❌ CustomerApp.jsx not found!"); fail++; }

console.log("\n=== OwnerApp.jsx ===");
const owner = readSafe("src/pages/owner/OwnerApp.jsx");
if (owner) {
  check("Messages: OwnerMessages imported", owner.includes('import OwnerMessages'));
  check("Offers: OwnerOffers imported", owner.includes('import OwnerOffers'));
  check("Analytics: OwnerAnalytics imported", owner.includes('import OwnerAnalytics'), "New this session — the 6-metric analytics tab");
  check("Analytics tab registered", owner.includes('key:"analytics"'));
  check("Payouts tab registered", owner.includes('key:"payouts"'));
  check("Payouts: fetchPayouts / requestPayout present", owner.includes("fetchPayouts") && owner.includes("requestPayout"));
  check("Services: recurrenceDays input present (revisit reminders)", owner.includes("recurrenceDays"));
  check("Back-gesture history sync present", owner.includes("isPoppingRef") && owner.includes("popstate"));
  check("Booking cards: Paid via UPI badge present", owner.includes("Paid via UPI") || owner.includes("UPI ✓") || owner.includes("UPI\""));
  check("OTP input: placeholder is short dash pattern (not long text)", owner.includes('placeholder="– – – –"'));
} else { console.log("  ❌ OwnerApp.jsx not found!"); fail++; }

console.log("\n=== AdminApp.jsx ===");
const admin = readSafe("src/pages/admin/AdminApp.jsx");
if (admin) {
  check("StoreDetailModal component present", admin.includes("StoreDetailModal"));
  check("Settlements tab registered", admin.includes('key:"settlements"'), "New this session — admin's way to process owner payout requests");
  check("Settlements: fetchPendingSettlements present", admin.includes("fetchPendingSettlements"));
  check("Settlements: completeSettlement present", admin.includes("completeSettlement"));
  check("Back-gesture history sync present", admin.includes("isPoppingRef") && admin.includes("popstate"));
} else { console.log("  ❌ AdminApp.jsx not found!"); fail++; }

console.log("\n=== New components this session ===");
check("components/OwnerAnalytics.jsx exists", fileExists("src/components/OwnerAnalytics.jsx"));
const analytics = readSafe("src/components/OwnerAnalytics.jsx");
if (analytics) {
  check("OwnerAnalytics: imports from recharts", analytics.includes("recharts"));
  check("OwnerAnalytics: local SectionHeader defined (not a broken shared import)", analytics.includes("const SectionHeader"), "SectionHeader isn't exported from UI.jsx — must be defined locally here");
}
check("components/ReferralScreen.jsx exists", fileExists("src/components/ReferralScreen.jsx"));
const referral = readSafe("src/components/ReferralScreen.jsx");
if (referral) {
  check("ReferralScreen: copy has error handling / fallback", referral.includes("copyToClipboard"));
  check("ReferralScreen: share has fallback for non-AbortError failures", referral.includes("AbortError"));
}
check("components/CustomerChatModal.jsx exists", fileExists("src/components/CustomerChatModal.jsx"));
check("components/OwnerMessages.jsx exists", fileExists("src/components/OwnerMessages.jsx"));
check("components/StoreCard.jsx exists", fileExists("src/components/StoreCard.jsx"));

console.log("\n=== package.json ===");
const pkg = readSafe("package.json");
if (pkg) {
  check("recharts installed (needed for OwnerAnalytics)", pkg.includes('"recharts"'));
}

console.log("\n=== index.html ===");
const indexHtml = readSafe("index.html");
if (indexHtml) {
  check("user-scalable=no removed (accessibility)", !indexHtml.includes("user-scalable=no"));
  check("maximum-scale removed (accessibility)", !indexHtml.includes("maximum-scale"));
  check("Razorpay checkout script included", indexHtml.includes("checkout.razorpay.com"), "Needed once real (non-dev-mode) payments are used");
}

console.log("\n=== Support contact info ===");
check("CustomerApp.jsx: no leftover placeholder phone number", !(cust||"").includes("9876543210"), "This exact number has reverted more than once this session — if this fails, someone's working from a stale copy of CustomerApp.jsx");
check("OwnerApp.jsx: no leftover placeholder phone number", !(owner||"").includes("9876543210"), "Same as above, in OwnerApp.jsx");

console.log("\n=== Other pages ===");
check("PrivacyPolicy.jsx exists", fileExists("src/pages/PrivacyPolicy.jsx"));
check("TermsOfService.jsx exists", fileExists("src/pages/TermsOfService.jsx"));
const privacy = readSafe("src/pages/PrivacyPolicy.jsx");
if (privacy) {
  check("PrivacyPolicy: accepts onBack prop (for in-app overlay use)", privacy.includes("onBack"));
}
const splash = readSafe("src/pages/Splash.jsx");
if (splash) {
  check("Splash: no Admin card shown publicly", !splash.includes('role:"admin"') && !splash.includes("Admin Panel"));
  check("Splash: Terms/Privacy footer links present", splash.includes("/terms") && splash.includes("/privacy"));
}

console.log("\n=== Owner phone login (Auth.jsx) ===");
const authPage = readSafe("src/pages/Auth.jsx");
check("src/pages/Auth.jsx exists", !!authPage);
if (authPage) {
  check("Auth: owner role uses the OTP flow, not email/password", /usesOtpFlow\s*=\s*role\s*===\s*"customer"\s*\|\|\s*role\s*===\s*"owner"/.test(authPage));
  check("Auth: role is passed to send-otp/verify-otp calls", authPage.includes("role }") || authPage.includes("role:role") || authPage.includes(", role"));
  check("Auth: admin still uses email/password (deliberately unchanged)", authPage.includes('role !== "admin"') || authPage.includes("tab"));
}

console.log("\n=== Variable pricing + settings toggles (Customer/Owner apps) ===");
if (cust) {
  check("CustomerApp: hasVariablePriceSelected restricts payment options", cust.includes("hasVariablePriceSelected"));
  check("CustomerApp: upiEnabled setting is fetched and respected", cust.includes("upiEnabled"));
  check("CustomerApp: referralEnabled setting is fetched and respected", cust.includes("referralEnabled"));
  check("CustomerApp: search suggestions dropdown present", cust.includes("getSearchSuggestions"));
  check("CustomerApp: suggestion taps use onMouseDown+preventDefault (not onClick)", /onMouseDown=\{e => \{ e\.preventDefault/.test(cust), "onClick alone is unreliable here — blur can hide the dropdown before a touch tap registers as a click");
}
if (owner) {
  check("OwnerApp: at least one store photo required at registration", owner.includes("at least one photo"));
  check("OwnerApp: pending-approval screen shows real submitted details (not just a static wait message)", owner.includes("OwnerSettings myStore={myStore}") && owner.includes("!myStore.isApproved"));
  check("OwnerApp: variable pricing toggle present in service forms", owner.includes("isPriceVariable"));
}
if (admin) {
  check("AdminApp: referral program toggle present", admin.includes("toggleReferralProgram"));
  check("AdminApp: UPI payments toggle present", admin.includes("toggleUpiPayments"));
}

console.log("\n=== Shared components ===");
const uiComponent = readSafe("src/components/UI.jsx");
if (uiComponent) {
  check("UI.jsx: StarRating component exists (half-star support)", uiComponent.includes("export function StarRating"));
  check("StarRating: half-fill uses SVG gradient, not a rectangular clip", uiComponent.includes("linearGradient"), "A rectangular clip cuts through the star's points at an angle and looks visibly broken");
}
const constantsFile = readSafe("src/constants.js");
if (constantsFile) {
  check("constants.js: unisex_salon category present", constantsFile.includes("unisex_salon"));
  check("constants.js: Beauty & Grooming ordered directly after Health & Medical", /id:\s*"health"[\s\S]{0,400}id:\s*"beauty"/.test(constantsFile));
}
const categoryArt = readSafe("src/components/CategoryArt.jsx");
if (categoryArt) {
  check("CategoryArt: unisex_salon has an image mapping (not silently blank)", categoryArt.includes("unisex_salon:"));
}

console.log("\n=== One-off scripts cleanup ===");
const scriptFiles = fs.readdirSync(".").filter(f => f.startsWith("fix-") || f.startsWith("diagnostic-"));
check("No leftover one-off fix scripts in frontend root", scriptFiles.length === 0, `Found: ${scriptFiles.join(", ")} — delete these before release`);

console.log("\n" + "=".repeat(50));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log("=".repeat(50));
if (failures.length > 0) {
  console.log("\n--- ACTION NEEDED ---");
  failures.forEach(f => { console.log(`\n❌ ${f.label}`); if (f.fixHint) console.log(`   Fix: ${f.fixHint}`); });
}
