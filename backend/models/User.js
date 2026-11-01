// models/User.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: [true, "Name is required"], trim: true, maxlength: 50 },
  email:    { type: String, required: [true, "Email is required"], lowercase: true, trim: true, match: [/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/, "Invalid email"] }, // the previous nested-quantifier pattern backtracked exponentially — one ~40-char value froze the server
  // Not required — Google-only accounts legitimately have no phone
  // number (set to null explicitly, not just omitted), and the schema
  // previously rejecting that was a pre-existing bug that would have
  // broken Google sign-in the moment it actually ran through full
  // validation.
  phone:    { type: String, match: [/^[6-9]\d{9}$/, "Invalid Indian phone number"] },
  // false = typed into the profile without proof. A phone OTP / Google
  // login proving that number/email takes precedence over such a claim,
  // so nobody can pre-claim someone else's identity and later share or
  // control the account the real person logs into. Unset (older
  // accounts, or proven at signup) is treated as verified.
  phoneVerified: { type: Boolean },
  emailVerified: { type: Boolean },
  password: { type: String, required: [true, "Password is required"], minlength: 6, select: false },
  role:     { type: String, enum: ["customer","owner","admin"], default: "customer" },
  city:     { type: String, default: "" },
  area:     { type: String, default: "" },
  avatar:   { type: String, default: "" },
  favorites:  [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }],
  isVerified: { type: Boolean, default: false },
  isActive:   { type: Boolean, default: true },
  lastLogin:  { type: Date,    default: Date.now },
  fcmToken:   { type: String,  default: "" },
  noShowCount:           { type: Number, default: 0 },           // cumulative no-shows
  bookingRestrictedUntil:{ type: Date,   default: null },        // null = not restricted
  referralCode:          { type: String, default: "", sparse: true },
  referredBy:            { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  referralCount:         { type: Number, default: 0 },
  walletBalance:         { type: Number, default: 0 },
  googleId:              { type: String, default: "" },
  notifPrefs: {
    bookingReminders: { type: Boolean, default: true },
    offers:            { type: Boolean, default: true },
    chat:              { type: Boolean, default: true },
  },
  savedAddresses: [{
    label:   { type: String },
    address: { type: String },
  }],
}, { timestamps: true });

// Same phone number can now have up to 3 separate accounts — one per
// role (customer, owner, admin) — rather than one account total. This
// specifically supports a store owner also using their own phone to
// book as a customer at other stores, without those being the same
// login. Each individual (phone, role) pair still must be unique, so
// a phone genuinely can't have two owner accounts, for example.
// Only accounts that actually HAVE a phone are indexed — Google-only
// accounts have phone:null. This used to be sparse:true, but a compound
// sparse index still indexes every document that has ANY of its fields,
// and role is always set — so phone:null accounts all collided and the
// second Google-only customer could never sign up. The old index
// (phone_1_role_1) is dropped once at startup — see server.js.
UserSchema.index(
  { phone: 1, role: 1 },
  { unique: true, name: "phone_role_unique", partialFilterExpression: { phone: { $type: "string" } } }
);

// Same reasoning applies to email — a Google account (or an OTP
// placeholder email) needs to be able to exist as a separate customer
// account AND a separate owner account, without the two colliding.
// email is always genuinely present for every account (never null),
// so this one doesn't need sparse the way phone does.
UserSchema.index({ email: 1, role: 1 }, { unique: true });

UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", UserSchema);