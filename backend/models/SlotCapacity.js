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

// "9:00 AM" <-> minutes-since-midnight, formatted exactly like
// bookingController's generateSlots so counter keys always match the
// slot strings customers pick from.
const toMinutes = (t) => {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
};
const toLabel = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

// Seats are counted per 5-minute piece of the day (the step owners enter
// service durations in). Customer slots are blocks as long as the chosen
// services, so starts land on times like 10:50 or 11:40 — fine-grained
// pieces make any two bookings that truly overlap compete for the same
// counter, whatever their lengths. Reserving only the starting slot (as
// originally) let someone book 10:30 on top of a 10:00 combo still running.
const BUCKET_MINUTES = 5;

// Every piece a booking occupies, e.g. 50 mins at 10:00 -> 10:00, 10:05 ... 10:45.
SlotCapacitySchema.statics.coveredSlots = (startSlot, duration) => {
  const start = toMinutes(startSlot);
  const end = start + Math.max(duration || BUCKET_MINUTES, 1);
  const slots = [];
  for (let t = start - (start % BUCKET_MINUTES); t < end; t += BUCKET_MINUTES) slots.push(toLabel(t));
  return slots;
};

// Atomically takes one seat in each slot; any full slot throws the
// duplicate-key error the callers already translate into "slot full",
// and since callers run this inside their transaction, a partial
// reservation is rolled back with it.
SlotCapacitySchema.statics.reserve = async function (store, date, slots, capacity, session) {
  for (const timeSlot of slots) {
    await this.findOneAndUpdate(
      { store, date, timeSlot, bookedCount: { $lt: capacity || 1 } },
      { $inc: { bookedCount: 1 }, $setOnInsert: { store, date, timeSlot } },
      { upsert: true, session }
    );
  }
};

// Frees every seat a booking holds. Bookings made before reservedSlots
// existed only ever held their starting slot, so fall back to that.
SlotCapacitySchema.statics.releaseFor = function (booking, session) {
  const held = booking.reservedSlots?.length ? booking.reservedSlots : [booking.timeSlot];
  return this.updateMany(
    { store: booking.store._id || booking.store, date: booking.date, timeSlot: { $in: held }, bookedCount: { $gt: 0 } },
    { $inc: { bookedCount: -1 } },
    { session }
  );
};

module.exports = mongoose.model("SlotCapacity", SlotCapacitySchema);