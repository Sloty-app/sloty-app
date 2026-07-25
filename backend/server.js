// server.js — Sloty Backend
require("dns").setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
require("node:dns/promises").setDefaultResultOrder("ipv4first");
require("dotenv").config();

const express   = require("express");
const http      = require("http");
const cors      = require("cors");
const helmet    = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const morgan    = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoose  = require("mongoose");
const { initSocket, emitToRoom } = require("./config/socket");
const { runReminderCheck } = require("./config/reminderJob");
const { runRevisitCheck } = require("./config/revisitJob");
const { runNoShowCheck }  = require("./config/noShowJob");
const { runAbandonedPaymentCleanup } = require("./config/abandonedPaymentJob");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => { console.error("❌ MongoDB Failed:", err.message); process.exit(1); });

const app = express();

// Render (like most cloud hosts) sits in front of your app as a
// reverse proxy — without this, express-rate-limit can't safely
// determine a request's real IP from the X-Forwarded-For header and
// throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. "1" trusts exactly one
// proxy hop, matching Render's actual setup — not a blanket "trust
// everything," which would let a malicious client fake their IP.
app.set("trust proxy", 1);

// Explicit CSP — the default helmet CSP would silently block Razorpay's
// checkout script and Google's OAuth/Maps scripts (both loaded from
// external domains), since it locks script-src to 'self' by default.
// This explicitly allows only the specific third-party domains this
// app actually uses, rather than either breaking payments/Google
// sign-in or disabling CSP entirely — the same directive is exactly
// what stops an attacker from injecting an unrelated ad/tracking
// script even if some other part of the app had an XSS bug, since the
// browser refuses to execute or load anything from a domain not
// explicitly listed here.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://checkout.razorpay.com", "https://accounts.google.com", "https://apis.google.com"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com", "https://accounts.google.com", "https://www.googleapis.com"],
      frameSrc: ["https://api.razorpay.com", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https:"], // "https:" broad here since store/profile photos come from Cloudinary's dynamic URLs
      styleSrc: ["'self'", "'unsafe-inline'"], // inline styles are used throughout the frontend's component styling
    },
  },
}));

// Strips out any request body/query/param keys starting with "$" or
// containing "." — MongoDB's own query-operator syntax. Without this,
// a maliciously crafted JSON body (e.g. {"email": {"$ne": null}})
// could manipulate a query's actual logic instead of being treated as
// a literal value to search for, since Express's JSON parser has no
// way to know the difference on its own.
app.use(mongoSanitize());

// Allow both localhost (browser testing on this PC) and any LAN IP
// (phone testing on the same WiFi) — CORS checks the exact origin
// string, so a fixed single value would silently block the other one.
// DEV ONLY — accepts requests from any origin, so any device on your
// local network (phone, tablet, another laptop) can reach the API
// during testing. Tighten this back to a specific origin before
// deploying to production.
// CORS: reads allowed origins from ALLOWED_ORIGINS (comma-separated)
// when set — this is what you configure once you deploy to production,
// e.g. ALLOWED_ORIGINS=https://sloty.app,https://www.sloty.app
// Until then (no env var set), falls back to accepting localhost and
// any local network IP, so local dev + phone testing over WiFi keeps
// working exactly as it does today without any extra setup.
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin/non-browser requests (e.g. curl, mobile app webviews)
    if (configuredOrigins.length > 0) {
      // Production mode — strict allowlist only.
      return configuredOrigins.includes(origin)
        ? callback(null, true)
        : callback(new Error("Not allowed by CORS"));
    }
    // Dev mode fallback — localhost + any local network IP.
    const isDevOrigin = origin === "http://localhost:5173"
      || /^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)
      || /^http:\/\/10\.\d+\.\d+\.\d+:5173$/.test(origin);
    callback(null, isDevOrigin);
  },
  credentials: true,
}));

const limiter = rateLimit({ windowMs: 15*60*1000, max: 200, message: { success: false, message: "Too many requests." } });
app.use("/api/", limiter);

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ success: true, app: "Sloty API 🚀", status: "Running" });
});

app.use("/api/auth",          require("./routes/auth"));
app.use("/api/stores",        require("./routes/stores"));
app.use("/api/bookings",      require("./routes/bookings"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/support",       require("./routes/support"));
app.use("/api/chat",          require("./routes/chat"));
app.use("/api/referral",      require("./routes/referral"));
app.use("/api/assistant",     require("./routes/assistant"));
app.use("/api/offers",        require("./routes/offers"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/settlements", require("./routes/settlements"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/settings", require("./routes/settings"));

app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Hardened so an unexpected error (e.g. a raw database error, a bug
// somewhere that wasn't caught by that route's own try/catch) never
// leaks internal details like a connection string, file path, or stack
// trace to the client — only ever a generic message. Full detail still
// goes to your own server logs via console.error, just never in the
// HTTP response itself.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  const isDev = process.env.NODE_ENV === "development";
  res.status(err.status || 500).json({
    success: false,
    message: isDev ? (err.message || "Something went wrong!") : "Something went wrong. Please try again.",
  });
});

// Socket.io needs the raw HTTP server, not just the Express app
const server = http.createServer(app);
initSocket(server);

// Location-aware "time to head out" reminders — checks every 60s for
// confirmed bookings today whose travel-time window has arrived, and
// pushes a reminder exactly once (uses the existing reminderSent flag).
setInterval(() => {
  runReminderCheck().catch(err => console.error("Reminder job error:", err.message));
}, 60 * 1000);

// Revisit nudges aren't time-critical to the minute — checking every 6
// hours is plenty, and keeps this cheap to run continuously.
setInterval(() => {
  runRevisitCheck().catch(err => console.error("Revisit job error:", err.message));
}, 6 * 60 * 60 * 1000);

// No-show detection — runs every 30 minutes to catch expired confirmed
// bookings and mark them as no_show, incrementing the customer's count.
setInterval(() => {
  runNoShowCheck().catch(err => console.error("No-show job error:", err.message));
}, 30 * 60 * 1000);

// checked every 10 minutes — frequent enough that an abandoned upi
// booking's slot doesn't stay locked for long, cheap enough to run
// continuously without concern.
setInterval(() => {
  runAbandonedPaymentCleanup().catch(err => console.error("abandoned payment cleanup error:", err.message));
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log("═══════════════════════════════════════");
  console.log("  📍 Sloty Backend Server");
  console.log("═══════════════════════════════════════");
  console.log(`  🚀 Running on port ${PORT}`);
  console.log(`  📡 API: http://localhost:${PORT}`);
  console.log(`  🔌 Socket.io attached`);
  console.log("═══════════════════════════════════════");
});