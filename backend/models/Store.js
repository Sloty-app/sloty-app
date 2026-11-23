// models/Store.js
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/; // 24-hour "HH:MM"
const mongoose = require("mongoose");

// Caps so one form entry can't bloat every response that carries the store.
const max = (n, what) => [n, `${what} can be at most ${n} characters`];
const atMost = (n, what) => ({ validator: (v) => !v || v.length <= n, message: `${what}: at most ${n}` });
const HTTPS_URL = /^https:\/\/\S+$/;
const CATEGORIES = ["salon","mechanic_bike","mechanic_car","doctor","dentist","mobile_repair","medical_lab","optician","beauty_parlour","unisex_salon"];

const ServiceSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: max(60, "Service name") },
  // Not required when isPriceVariable is true — some services (car
  // PPF, bike repairs needing unknown spare parts) genuinely can't be
  // priced without inspecting the vehicle first. When variable, price
  // is simply unused/ignored rather than needing a placeholder value.
  price:    { type: Number, required: function() { return !this.isPriceVariable; } },
  isPriceVariable: { type: Boolean, default: false },
  duration: { type: Number, required: true, min: [5, "A service must take at least 5 minutes"], max: [720, "A service can take at most 12 hours"] }, // minutes
  // Owner-set revisit reminder — how many days after a booking of this
  // service to nudge the customer to book again (e.g. 30 for a monthly
  // haircut). null/unset means no automatic revisit reminder for this
  // particular service.
  recurrenceDays: { type: Number, default: null, min: 1 },
});

const ReviewSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name:    { type: String, maxlength: 50 },
  rating:  { type: Number, min: 1, max: 5 },
  comment: { type: String, maxlength: max(500, "Review") },
}, { timestamps: true });

// One staff member / doctor at a store. Bookings reference this by _id
// (Booking.staffId) so each staff member gets their own independent
// queue, token sequence, and slot availability within the same store.
const StaffSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true, maxlength: max(50, "Team member name") },
  specialization: { type: String, default: "", trim: true, maxlength: max(60, "Specialization") }, // e.g. "Cardiologist", "Senior Barber"
  isActive:       { type: Boolean, default: true }, // owner can hide without deleting (e.g. doctor on leave)
}, { timestamps: true });

const StoreSchema = new mongoose.Schema({
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:     { type: String, required: [true, "Store name required"], trim: true, maxlength: max(80, "Store name") },
  category: {
    type: String, required: true,
    enum: { values: CATEGORIES, message: "Pick a category from the list" },
  },
  description: { type: String, default: "", maxlength: max(1000, "Description") },
  phone:    { type: String, required: true, maxlength: max(15, "Phone") },
  whatsapp: { type: String, default: "", maxlength: max(15, "WhatsApp number") },
  email:    { type: String, default: "", maxlength: max(100, "Email") },
  address:  { type: String, required: true, trim: true, maxlength: max(300, "Address") },
  city:     { type: String, required: true, trim: true, maxlength: max(60, "City") },
  area:     { type: String, default: "", trim: true, maxlength: max(60, "Area") },
  pincode:  { type: String, required: true, trim: true, maxlength: max(10, "Pincode") },
  // Captured from "Use My Location" or address search at registration —
  // powers distance-aware reminders for customers booking here.
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },

  services: { type: [ServiceSchema], validate: atMost(50, "Services") },

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
  staff:    { type: [StaffSchema], validate: atMost(50, "Team members") },

  workingHours: {
    open:  { type: String, default: "09:00", match: [HHMM, "Opening time must look like 09:00"] },
    close: { type: String, default: "21:00", match: [HHMM, "Closing time must look like 21:00"] },
    days:  { type: [String], default: ["Mon","Tue","Wed","Thu","Fri","Sat"] },
  },

  slotDuration:      { type: Number, default: 30, min: 5, max: 240 },
  maxAdvanceBooking: { type: Number, default: 7  },

  // Break times (same every day)
  breakTimes: { validate: atMost(10, "Breaks"), type: [{
    open:  { type: String, match: [HHMM, "Break start must look like 13:00"] }, // e.g. "13:00"
    close: { type: String, match: [HHMM, "Break end must look like 14:00"] }, // e.g. "14:00"
    label: { type: String, default: "Break", maxlength: max(30, "Break label") },
  }] },

  // Blocked slots by date
  blockedSlots: { validate: atMost(400, "Blocked dates"), type: [{
    date:   { type: String }, // YYYY-MM-DD
    slots:  [{ type: String }], // ["1:00 PM", "1:30 PM"]
    reason: { type: String, default: "Unavailable", maxlength: max(100, "Reason") },
  }] },

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
  // Running sum backing `rating` — lets a new review update the average
  // with plain arithmetic (sum + newRating) / (count + 1) instead of
  // re-reducing the entire reviews array on every submission. Left
  // unset (not defaulted to 0) specifically so existing stores that
  // predate this field can be told apart from a genuinely new store —
  // see addReview, which reconstructs it once from rating*totalReviews
  // the first time a store with this field missing gets reviewed again.
  ratingSum:    { type: Number, default: null },

  // Links to uploaded images (Cloudinary), not the images themselves.
  photos:  { type: [{ type: String, maxlength: 500, match: [HTTPS_URL, "Photos must be https links"] }], validate: atMost(4, "Photos") },
  reviews: [ReviewSchema],

  // Admin fields
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  rejectedReason: { type: String, default: "", maxlength: 300 },

  // Name, category or address changes an APPROVED store makes wait here
  // for an admin (see storeController.updateStore); customers keep seeing
  // the approved values until then. null = nothing waiting.
  pendingChanges: {
    type: new mongoose.Schema({
      name:     { type: String, trim: true, maxlength: max(80, "Store name") },
      category: { type: String, enum: { values: CATEGORIES, message: "Pick a category from the list" } },
      address:  { type: String, trim: true, maxlength: max(300, "Address") },
      city:     { type: String, trim: true, maxlength: max(60, "City") },
      area:     { type: String, trim: true, maxlength: max(60, "Area") },
      pincode:  { type: String, trim: true, maxlength: max(10, "Pincode") },
      location: { lat: { type: Number }, lng: { type: Number } },
      submittedAt: { type: Date, default: Date.now },
    }, { _id: false }),
    default: null,
  },
  // Why the admin turned down the last changes (shown to the owner).
  changesRejectedReason: { type: String, default: "", maxlength: 300 },

}, { timestamps: true });

// Hot query indexes — speeds up store listing, category filtering, city search
StoreSchema.index({ city: 1, category: 1, isApproved: 1 });
StoreSchema.index({ owner: 1 });
StoreSchema.index({ name: "text", city: "text" }); // text search

module.exports = mongoose.model("Store", StoreSchema);