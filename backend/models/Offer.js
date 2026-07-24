// models/Offer.js
const mongoose = require("mongoose");

const OfferSchema = new mongoose.Schema({
  store:       { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  title:       { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, trim: true, maxlength: 200, default: "" },

  discountType:  { type: String, enum: ["percentage", "flat"], required: true },
  discountValue: { type: Number, required: true, min: 1 },

  // Discount only applies if the booking subtotal meets this minimum.
  minBookingValue: { type: Number, default: 0 },

  // Cap on how much a percentage discount can knock off in rupees, so a
  // "50% off" offer can't accidentally wipe out an entire large booking.
  // Ignored for flat discounts (those already have a fixed ceiling).
  maxDiscountAmount: { type: Number, default: null },

  // Empty array = applies to ALL services at this store. Otherwise, only
  // applies if at least one selected service name matches this list.
  applicableServices: [{ type: String }],

  validFrom:  { type: Date, required: true },
  validUntil: { type: Date, required: true },

  isActive: { type: Boolean, default: true }, // owner can pause without deleting
}, { timestamps: true });

// Fast lookup of currently-active offers for a store.
OfferSchema.index({ store: 1, isActive: 1 });

module.exports = mongoose.model("Offer", OfferSchema);