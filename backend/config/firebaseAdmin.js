// config/firebaseAdmin.js
//
// Server-side Firebase verification — independently confirms a phone
// number was genuinely verified by Firebase, rather than trusting
// whatever the frontend claims. Same trust boundary as googleAuth.js.
//
// Uses firebase-admin's modular API (importing specific functions
// directly) rather than the older single "admin" namespace object —
// the installed version here doesn't expose admin.apps/admin.credential
// as properties the older style expects, which is what was actually
// causing both prior errors.
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let authInstance = null;

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error("⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not set — Firebase phone login will fail until this is configured.");
} else {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    // getApps().length guards against re-initializing on a nodemon
    // reload, same purpose as the old admin.apps.length check.
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    authInstance = getAuth(app);
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase Admin init failed — check FIREBASE_SERVICE_ACCOUNT_KEY is valid JSON:", err.message);
  }
}

// Exported as a function so authController.js always gets whatever the
// current authInstance is (null if init failed, no need to change the
// calling code either way — just returns something you can call
// .verifyIdToken() on, or that throws a clear "not configured" error).
module.exports = {
  getFirebaseAuth: () => {
    if (!authInstance) throw new Error("Firebase Admin is not initialized — check FIREBASE_SERVICE_ACCOUNT_KEY");
    return authInstance;
  },
};