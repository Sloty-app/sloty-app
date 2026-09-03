// models/SupportTicket.js
const mongoose = require("mongoose");

const SupportTicketSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName:  { type: String, required: true },
  userPhone: { type: String, required: true },
  userRole:  { type: String, enum: ["customer","owner"], required: true },

  category: {
    type: String,
    enum: ["booking_issue","payment_issue","store_issue","app_bug","account","other"],
    default: "other",
  },
  subject: { type: String, required: true, trim: true, maxlength: 100 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },

  status: { type: String, enum: ["open","in_progress","resolved"], default: "open" },
  adminNotes: { type: String, default: "" },
  resolvedAt: { type: Date },

}, { timestamps: true });

// A user's own ticket list, and the admin queue filtered by status —
// the two actual query patterns this collection sees.
SupportTicketSchema.index({ user: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);