// models/Store.js
const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  // Not required when isPriceVariable is true — some services (car
  // PPF, bike repairs needing unknown spare parts) genuinely can't be
  // priced without inspecting the vehicle first. When variable, price
  // is simply unused/ignored rather than needing a placeholder value.
  price:    { type: Number, required: function() { return !this.isPriceVariable; } },
  isPriceVariable: { type: Boolean, default: false },
  duration: { type: Number, required: true }, // minutes
  // Owner-set revisit reminder — how many days after a booking of this
  // service to nudge the customer to book again (e.g. 30 for a monthly
  // haircut). null/unset means no automatic revisit reminder for this
  // particular service.
  recurrenceDays: { type: Number, default: null, min: 1 },
});

const ReviewSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name:    String,
  rating:  { type: Number, min: 1, max: 5 },
  comment: String,
}, { timestamps: true });

// One staff member / doctor at a store. Bookings reference this by _id
// (Booking.staffId) so each staff member gets their own independent
// queue, token sequence, and slot availability within the same store.
const StaffSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  specialization: { type: String, default: "", trim: true }, // e.g. "Cardiologist", "Senior Barber"
  isActive:       { type: Boolean, default: true }, // owner can hide without deleting (e.g. doctor on leave)
}, { timestamps: true });

const StoreSchema = new mongoose.Schema({
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:     { type: String, required: [true, "Store name required"], trim: true },
  category: {
    type: String, required: true,
    enum: ["salon","mechanic_bike","mechanic_car","doctor","dentist","mobile_repair","medical_lab","optician","beauty_parlour","unisex_salon"],
  },
  description: { type: String, default: "" },
  phone:    { type: String, required: true },
  whatsapp: { type: String, default: "" },
  email:    { type: String, default: "" },
  address:  { type: String, required: true },
  city:     { type: String, required: true },
  area:     { type: String, default: "" },
  pincode:  { type: String, required: true },
  // Captured from "Use My Location" or address search at registration —
  // powers distance-aware reminders for customers booking here.
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },

  services: [ServiceSchema],

  // Multi-staff / multi-doctor support — opt-in per store.
  // When false (default), the store behaves exactly as before: one
  // shared queue, one token sequence, no staff selection in booking.
  hasStaff: { type: Boolean, default: false },
  // How many customers can be booked into the SAME time slot when the
  // store does NOT use named-staff selection (hasStaff: false) — e.g.
  // a barbershop with 3 interchangeable barbers sets this to 3, and up
  // to 3 people can book the same slot without ever picking a staff
  // name. Irrelevant/ignored when hasStaff is true, since named staff
  // already get independent slot availability per person.
  slotCapacity: { type: Number, default: 1, min: 1 },
  staff:    [StaffSchema],

  workingHours: {
    open:  { type: String, default: "09:00" },
    close: { type: String, default: "21:00" },
    days:  { type: [String], default: ["Mon","Tue","Wed","Thu","Fri","Sat"] },
  },

  slotDuration:      { type: Number, default: 30 },
  maxAdvanceBooking: { type: Number, default: 7  },

  // Break times (same every day)
  breakTimes: [{
    open:  { type: String }, // e.g. "13:00"
    close: { type: String }, // e.g. "14:00"
    label: { type: String, default: "Break" },
  }],

  // Blocked slots by date
  blockedSlots: [{
    date:   { type: String }, // YYYY-MM-DD
    slots:  [{ type: String }], // ["1:00 PM", "1:30 PM"]
    reason: { type: String, default: "Unavailable" },
  }],

  // ── STATUS ── (THE KEY FIELD)
  // isApproved: false  → Owner registered, waiting for admin approval
  // isApproved: true   → Admin approved, visible to customers
  isApproved: { type: Boolean, default: false },
  isOpen:     { type: Boolean, default: true  },
  isActive:   { type: Boolean, default: true  },
  // Running total of UPI revenue collected through the app on this
  // store's behalf, not yet paid out to the owner. Incremented when a
  // booking's UPI payment is verified; decremented when a settlement
  // is marked completed by an admin.
  pendingUpiBalance: { type: Number, default: 0 },
  removedAt:  { type: Date, default: null },
  removedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  // ── STATS ──
  rating:       { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  totalBookings:{ type: Number, default: 0 },

  photos:  [{ type: String }],
  reviews: [ReviewSchema],

  // Admin fields
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  rejectedReason: { type: String, default: "" },

}, { timestamps: true });

// Hot query indexes — speeds up store listing, category filtering, city search
StoreSchema.index({ city: 1, category: 1, isApproved: 1 });
StoreSchema.index({ owner: 1 });
StoreSchema.index({ name: "text", city: "text" }); // text search

module.exports = mongoose.model("Store", StoreSchema);