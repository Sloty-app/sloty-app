// models/SlotCapacity.js
//
// Tracks how many pooled (no named staff) bookings currently occupy a
// given store+date+timeSlot. Used to atomically enforce the store's
// configured slotCapacity (e.g. "3 barbers = 3 concurrent bookings")
// without a race condition — findOneAndUpdate on a single document is
// atomic in MongoDB even without a transaction, which is what makes
// this safe under concurrent requests.
const mongoose = require("mongoose");

const SlotCapacitySchema = new mongoose.Schema({
  store:       { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  date:        { type: String, required: true }, // "YYYY-MM-DD"
  timeSlot:    { type: String, required: true }, // e.g. "10:00 AM"
  bookedCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// One counter document per store+date+timeSlot — the unique index is
// what makes the "reserve a seat" upsert pattern safe: if capacity is
// already full, the conditional upsert has nowhere valid to write and
// throws a duplicate-key error instead of silently over-booking.
SlotCapacitySchema.index({ store: 1, date: 1, timeSlot: 1 }, { unique: true, name: "one_counter_per_slot" });

module.exports = mongoose.model("SlotCapacity", SlotCapacitySchema);