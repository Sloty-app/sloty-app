// models/User.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: [true, "Name is required"], trim: true, maxlength: 50 },
  email:    { type: String, required: [true, "Email is required"], lowercase: true, trim: true, match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Invalid email"] },
  // Not required — Google-only accounts legitimately have no phone
  // number (set to null explicitly, not just omitted), and the schema
  // previously rejecting that was a pre-existing bug that would have
  // broken Google sign-in the moment it actually ran through full
  // validation.
  phone:    { type: String, match: [/^[6-9]\d{9}$/, "Invalid Indian phone number"] },
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
// sparse:true is important here — Google-only accounts have
// phone:null, and without sparse, every null-phone account of the
// same role would incorrectly collide with every other one on that
// shared null value.
UserSchema.index({ phone: 1, role: 1 }, { unique: true, sparse: true });

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