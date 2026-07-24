// models/Settings.js
//
// A single-document collection for app-wide settings an admin can
// toggle live, without needing a server restart or .env change. Only
// one document ever exists — always fetched/updated via a fixed
// singleton key, never created multiple times.
const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  singleton: { type: String, default: "app_settings", unique: true },
  referralProgramEnabled: { type: Boolean, default: false },
  // Defaults to false — UPI/online payment stays hidden (customers only
  // see "Pay at Store") until an admin turns it on once real Razorpay
  // credentials are live. Same toggle mechanism as the referral program.
  upiPaymentsEnabled: { type: Boolean, default: false },
}, { timestamps: true });

// Fetches the one settings document, creating it with defaults on
// first-ever use so callers never have to handle a missing document.
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ singleton: "app_settings" });
  if (!settings) {
    settings = await this.create({ singleton: "app_settings" });
  }
  return settings;
};

module.exports = mongoose.model("Settings", SettingsSchema);