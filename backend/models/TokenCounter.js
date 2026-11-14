// models/TokenCounter.js
// One counter per store, day and (for named-staff stores) staff member.
// Tokens come from an atomic $inc on it, so a number is never handed out
// twice: counting today's bookings did that whenever one was cancelled or
// moved to another day.
const mongoose = require("mongoose");

const TokenCounterSchema = new mongoose.Schema({
  store:   { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  date:    { type: String, required: true }, // YYYY-MM-DD (IST)
  staffId: { type: mongoose.Schema.Types.ObjectId, default: null },
  seq:     { type: Number, default: 0 },
});
TokenCounterSchema.index({ store: 1, date: 1, staffId: 1 }, { unique: true });

// Returns the next sequence number (1, 2, 3...) for this store/day/staff.
// Deliberately not part of the booking's transaction: every booking at a
// store that day touches this one document, and inside transactions
// simultaneous bookings would abort each other. A booking that fails after
// taking a number just leaves a gap. A counter created for a day that
// already has bookings (made before counters existed) starts after them.
TokenCounterSchema.statics.next = async function (store, date, staffId) {
  const key = { store, date, staffId: staffId || null };
  if (!(await this.exists(key))) {
    const issued = await mongoose.model("Booking").countDocuments(key);
    try {
      await this.updateOne(key, { $setOnInsert: { seq: issued } }, { upsert: true });
    } catch (err) {
      if (err.code !== 11000) throw err; // another booking created it first
    }
  }
  const c = await this.findOneAndUpdate(key, { $inc: { seq: 1 } }, { new: true });
  return c.seq;
};

module.exports = mongoose.model("TokenCounter", TokenCounterSchema);
