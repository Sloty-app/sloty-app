// models/Conversation.js — one conversation per (customer, store) pair,
// reused across all that customer's bookings with this store. Messages
// are embedded directly since chat volume per conversation is modest.
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  senderRole: { type: String, enum: ["customer", "owner"], required: true },
  text:       { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true });

const ConversationSchema = new mongoose.Schema({
  customer:     { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true },
  store:        { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  customerName: { type: String },
  storeName:    { type: String },
  messages:       [MessageSchema],
  lastMessageAt:  { type: Date, default: Date.now },
  lastMessageText:{ type: String, default: "" },
  customerUnread: { type: Number, default: 0 }, // unread count shown to the customer
  ownerUnread:    { type: Number, default: 0 }, // unread count shown to the store owner
}, { timestamps: true });

// One conversation per customer+store pair — re-used across bookings.
ConversationSchema.index({ customer: 1, store: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", ConversationSchema);