// scripts/make-admin.js
//
// Admin accounts can't be created through the app on purpose (the
// register/OTP/Google endpoints all ignore a client-sent "admin" role),
// so this is the supported way to make one. Run it against whichever
// database you point MONGO_URI at.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' \
//   MONGO_URI='mongodb+srv://...' node scripts/make-admin.js
//
// PowerShell:
//   $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="..."; $env:MONGO_URI="..."; node scripts/make-admin.js
//
// Behaviour:
//   - No user with that email       -> creates a new admin.
//   - Already an admin              -> resets that admin's password.
//   - Exists as customer/owner      -> refuses, and says why. Password
//     login finds accounts by email alone (no role filter), so a second
//     account under the same email can make login hit the wrong one.
//     Pass --promote to convert that existing account to an admin
//     instead (it stops being usable as a customer/owner login).
//
// The password is read from the environment, never printed, and hashed
// by the User model's own save hook.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const email    = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const phone    = (process.env.ADMIN_PHONE || "").trim();   // optional, 10-digit Indian number
const promote  = process.argv.includes("--promote");

const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

(async () => {
  if (!email)                 fail("ADMIN_EMAIL is required");
  if (password.length < 6)    fail("ADMIN_PASSWORD is required (min 6 characters)");
  if (!process.env.MONGO_URI) fail("MONGO_URI is required");

  await mongoose.connect(process.env.MONGO_URI);
  const host = new URL(process.env.MONGO_URI.replace(/^mongodb(\+srv)?:/, "http:")).host;
  console.log(`Connected to ${host}`);

  const existing = await User.find({ email }).select("+password");

  if (existing.length === 0) {
    await User.create({ name: "Sloty Admin", email, password, role: "admin", isVerified: true, ...(phone && { phone }) });
    console.log(`✅ Created admin account for ${email}`);
  } else {
    const admin = existing.find(u => u.role === "admin");
    if (admin) {
      admin.password = password;
      await admin.save();
      console.log(`✅ ${email} is already an admin — password reset`);
    } else {
      const roles = existing.map(u => u.role).join(", ");
      if (!promote) {
        fail(`${email} already exists as: ${roles}. Refusing to add a second account under the same email (login would be ambiguous). Re-run with --promote to convert it to an admin, or use a different email.`);
      }
      const u = existing[0];
      u.role = "admin";
      if (phone) u.phone = phone;
      u.password = password;
      u.isVerified = true;
      u.isActive = true;
      await u.save();
      console.log(`✅ Promoted existing ${roles} account ${email} to admin (password set)`);
    }
  }
  await mongoose.disconnect();
})().catch(e => {
  // The (phone, role) unique index counts "no phone" as a value, so a
  // second admin without a phone number collides with the first.
  if (e.code === 11000 && /phone_1_role_1/.test(e.message)) {
    fail("Another admin without a phone number already exists, and the database allows only one per role. Set ADMIN_PHONE to a 10-digit number for this one and re-run.");
  }
  fail(e.message);
});
