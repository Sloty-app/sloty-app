// models/PhoneOtp.js — short-lived OTP records for phone-based login.
// Not tied to a User document since the phone might belong to a brand
// new signup. MongoDB's TTL index auto-deletes expired records.
const mongoose = require("mongoose");

const PhoneOtpSchema = new mongoose.Schema({
  phone:     { type: String, required: true, index: true },
  otpHash:   { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts:  { type: Number, default: 0 },
}, { timestamps: true });

// Auto-delete the document once expiresAt passes — keeps the collection clean
PhoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PhoneOtp", PhoneOtpSchema);