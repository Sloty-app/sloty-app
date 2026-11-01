// config/abandonedPaymentJob.js
//
// A customer choosing "Pay Online" reserves the slot immediately (same
// atomic capacity logic as any booking), then has to actually complete
// payment as a second step. If they abandon that step — closing the
// app instead of tapping Cancel — the booking sits at
// paymentStatus:"pending" forever, silently holding the slot from
// every other customer with no way to ever release it.
//
// This job finds bookings stuck in exactly that state for longer than
// a reasonable grace period and cancels them, reusing the exact same
// capacity-release logic as a normal customer-initiated cancellation
// (bookingController.js's cancelBooking) so this behaves identically
// to that path rather than introducing a second, possibly-inconsistent
// way of freeing a slot.
const Booking = require("../models/Booking");
const SlotCapacity = require("../models/SlotCapacity");
const User = require("../models/User");
const { emitToRoom } = require("./socket");

const GRACE_PERIOD_MINUTES = 5;

async function runAbandonedPaymentCleanup() {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000);

  const staleBookings = await Booking.find({
    paymentMode: "upi",
    paymentStatus: "pending",
    status: { $nin: ["completed", "cancelled", "no_show"] },
    createdAt: { $lt: cutoff },
  });

  for (const booking of staleBookings) {
    // Conditional on the status just read — if the customer cancelled (or
    // the booking otherwise moved on) in the meantime, skip it rather than
    // releasing its seats a second time.
    const claimed = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status, paymentStatus: "pending" },
      { status: "cancelled", cancelReason: "Payment was never completed" }
    );
    if (!claimed) continue;
    // Wallet credit put towards the unfinished payment goes back.
    if (booking.walletDeducted > 0) {
      await User.findByIdAndUpdate(booking.customer, { $inc: { walletBalance: booking.walletDeducted } });
    }

    // Same capacity-release logic as a normal cancellation — pooled
    // (no named staff) bookings reserved a seat via SlotCapacity at
    // creation time; named-staff bookings never created one, so this
    // safely no-ops for them, matching cancelBooking's own behavior.
    if (!booking.staffId) {
      await SlotCapacity.releaseFor(booking);
    }

    emitToRoom(`store:${booking.store}:${booking.date}`, "queue:update", { reason:"cancelled", bookingId: booking._id });
    console.log(`Auto-cancelled abandoned UPI booking ${booking._id} (unpaid for over ${GRACE_PERIOD_MINUTES} min)`);
  }

  if (staleBookings.length > 0) {
    console.log(`Abandoned payment cleanup: released ${staleBookings.length} stale booking(s)`);
  }
}

module.exports = { runAbandonedPaymentCleanup };