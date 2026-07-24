// models/Settlement.js — tracks UPI settlement requests and their
// manual payout status. Money doesn't move automatically (that
// requires Razorpay Route + owner KYC, a bigger undertaking) — this
// is the ledger + request/approval workflow around a manual transfer
// the platform operator makes outside the app.
const mongoose = require("mongoose");

const SettlementSchema = new mongoose.Schema({
  store:  { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["requested", "completed"], default: "requested" },
  note:   { type: String, default: "" }, // admin's reference note for the manual transfer (UTR number, date, etc.)
  completedAt: { type: Date, default: null },
}, { timestamps: true });

SettlementSchema.index({ store: 1, status: 1 });

module.exports = mongoose.model("Settlement", SettlementSchema);