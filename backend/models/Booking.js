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

  razorpayOrderId:   { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  notes:        { type: String,  default: "" },
  cancelReason: { type: String,  default: "" },
  reminderSent: { type: Boolean, default: false },
  otp:          { type: String,  default: "" },
  otpVerified:  { type: Boolean, default: false },
  walletDeducted: { type: Number, default: 0 }, // persisted for booking history display

  // Set only when a paid UPI booking is cancelled — tracks whether the
  // customer received a wallet-credit refund (cancelled with enough
  // notice) or forfeited the payment (cancelled too close to the slot).
  // Never set for cash bookings, since there's nothing to refund.
  refundStatus: { type: String, enum: ["none","refunded_to_wallet","forfeited"], default: "none" },
  refundAmount: { type: Number, default: 0 },
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

module.exports = mongoose.model("Booking", BookingSchema);