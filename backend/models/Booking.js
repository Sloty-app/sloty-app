// models/Booking.js
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true },
  store:    { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },

  service: {
    name:          { type: String, required: true },
    price:         { type: Number, required: true },
    duration:      { type: Number, required: true },
    recurrenceDays:{ type: Number, default: null }, // for the revisit-reminder job
    originalPrice: { type: Number, default: null },  // pre-discount price, if an offer was applied
    offerDiscount: { type: Number, default: 0 },     // amount knocked off by an offer
  },

  // Itemized list when multiple services were booked together in one
  // visit — was previously computed but silently dropped by Mongoose
  // since it wasn't declared here. Now correctly persisted.
  serviceBreakdown: [{
    name:     { type: String },
    price:    { type: Number },
    duration: { type: Number },
  }],

  offerApplied: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },

  // Optional — only set when the store has multi-staff/doctor booking
  // enabled and the customer picked a specific staff member.
  staffId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  staffName: { type: String, default: "" },

  date:     { type: String, required: true }, // "2026-05-01"
  timeSlot: { type: String, required: true }, // "10:30 AM"

  tokenNumber:   { type: String, default: "" },
  queuePosition: { type: Number, default: 0  },

  status: {
    type: String,
    enum: ["confirmed","in_progress","completed","cancelled","no_show"],
    default: "confirmed",
  },

  customerName:  { type: String },
  customerPhone: { type: String },

  // Captured once at booking time — used to estimate travel time for the
  // location-aware "time to head out" reminder. Not continuously tracked.
  customerLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  estimatedTravelMinutes: { type: Number, default: null },

  paymentMode:   { type: String, enum: ["cash","upi","card"], default: "cash" },
  paymentStatus: { type: String, enum: ["pending","paid"],   default: "pending" },
  // Set by paymentController when a UPI payment is initiated/verified —
  // without these declared here, Mongoose's default strict mode silently
  // drops both fields on save (same class of bug serviceBreakdown had
  // above), which breaks payment verification entirely: verifyPayment
  // re-fetches the booking and compares its stored razorpayOrderId
  // against the client-supplied one, and that comparison can never
  // succeed against a field that was never actually persisted.
  razorpayOrderId:   { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },

  // Services the owner adds AFTER the original booking — e.g. customer
  // came in for a haircut, barber recommends a beard trim too. Kept
  // fully separate from serviceBreakdown/paymentStatus above rather
  // than merged in, since the original booking may already be paid
  // (via UPI) and this needs its own independent payment step —
  // retroactively changing a completed UPI payment isn't practical.
  addedServices: [{
    name:     { type: String },
    price:    { type: Number },
    duration: { type: Number },
    addedAt:  { type: Date, default: Date.now },
  }],
  addedServicesPaymentStatus: { type: String, enum: ["pending","paid"], default: "pending" },

  notes:        { type: String,  default: "" },
  cancelReason: { type: String,  default: "" },
  reminderSent: { type: Boolean, default: false },
  otp:          { type: String,  default: "" },
  otpVerified:  { type: Boolean, default: false },
  walletDeducted: { type: Number, default: 0 }, // persisted for booking history display
}, { timestamps: true });

BookingSchema.statics.generateToken = function(count) {
  const letter = String.fromCharCode(65 + Math.floor(count / 99));
  const number = (count % 99) + 1;
  return `${letter}${number}`;
};

// Prevent double-booking at the DB level — two simultaneous requests
// can both pass the app-level check, so this index catches the second
// one and returns a duplicate-key error instead of creating a conflict.
// Scoped to staffId != null ONLY — a named staff member genuinely can
// serve one customer at a time, so this stays a strict 1-per-slot
// index for that case. Pooled-capacity bookings (no named staff,
// staffId: null) are governed separately by the SlotCapacity atomic
// counter instead, since multiple concurrent bookings are expected
// and desired there (up to the store's configured capacity).
BookingSchema.index(
  { store: 1, date: 1, timeSlot: 1, staffId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["confirmed", "in_progress"] }, staffId: { $ne: null } },
    name: "no_double_booking",
  }
);

// Hot query indexes — speeds up owner dashboard, customer bookings, slot checks
BookingSchema.index({ store: 1, date: 1 });
BookingSchema.index({ customer: 1 });
// getLiveQueue/getAvailableSlots filter store+date+status on every call
// — extends the index above so Mongo can satisfy the status filter
// from the index itself instead of scanning every matching store+date
// document in memory.
BookingSchema.index({ store: 1, date: 1, status: 1 });

module.exports = mongoose.model("Booking", BookingSchema);