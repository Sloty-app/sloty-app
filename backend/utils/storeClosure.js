// utils/storeClosure.js
// When a store stops trading (its owner deletes their account, or an admin
// removes it), its upcoming bookings can't be served. Each one is
// cancelled, its seat released, any money the customer paid (UPI or
// wallet credit) returned to their Sloty wallet, and the customer told.
const Booking = require("../models/Booking");
const SlotCapacity = require("../models/SlotCapacity");
const Store = require("../models/Store");
const User = require("../models/User");
const sendNotification = require("../config/notify");
const { emitToRoom } = require("../config/socket");
const { getISTDateString } = require("./date");

async function cancelStoreBookings(storeIds, reason) {
  const upcoming = await Booking.find({ store: { $in: storeIds }, status: "confirmed", date: { $gte: getISTDateString() } })
    .populate("store", "name");
  let cancelled = 0;
  for (const b of upcoming) {
    // Same atomic claim as a customer cancel, so nothing is refunded twice.
    const claimed = await Booking.findOneAndUpdate({ _id: b._id, status: "confirmed" }, { status: "cancelled", cancelReason: reason });
    if (!claimed) continue;
    cancelled++;
    if (!b.staffId) await SlotCapacity.releaseFor(b);

    const upiPaid = b.paymentMode === "upi" && b.paymentStatus === "paid" ? Math.max(0, (b.service?.price || 0) - (b.walletDeducted || 0)) : 0;
    const refund = upiPaid + (b.walletDeducted || 0);
    if (refund > 0) {
      await User.updateOne({ _id: b.customer }, { $inc: { walletBalance: refund } });
      await Booking.updateOne({ _id: b._id }, { refundStatus: "refunded_to_wallet", refundAmount: refund });
      if (upiPaid > 0) {
        await Store.updateOne(
          { _id: b.store._id },
          [{ $set: { pendingUpiBalance: { $max: [0, { $subtract: ["$pendingUpiBalance", b.service?.price || 0] }] } } }]
        );
      }
    }

    emitToRoom(`user:${b.customer}`, "booking:status", { bookingId: b._id, status: "cancelled", storeName: b.store?.name });
    sendNotification(
      b.customer,
      "Booking cancelled",
      `${b.store?.name || "The store"} is no longer taking bookings on Sloty, so your ${b.date} ${b.timeSlot} booking was cancelled.${refund > 0 ? ` ₹${refund} was added to your Sloty wallet.` : ""}`
    ).catch(() => {});
  }
  return cancelled;
}

module.exports = { cancelStoreBookings };
