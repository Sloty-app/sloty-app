// models/Activity.js
//
// A lightweight, owner-facing activity log — separate from the push
// notification system (sendNotification), which is fire-and-forget and
// leaves no record if an owner misses it (phone silent, app closed).
// This gives owners a real "what happened while I was away" feed.
const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
  type: {
    type: String,
    enum: ["booking_created", "booking_cancelled"],
    required: true,
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
}, { timestamps: true });

// Most-recent-first is the only access pattern this is ever queried by.
ActivitySchema.index({ store: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", ActivitySchema);