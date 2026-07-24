const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subscription: { type: Object, required: true },
  role:         { type: String, enum: ["customer","owner","admin"], default: "customer" },
}, { timestamps: true });

module.exports = mongoose.model("Subscription", SubscriptionSchema);