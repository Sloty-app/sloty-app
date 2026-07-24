// config/revisitJob.js — "time to come back" nudges. Runs periodically,
// finds completed bookings whose service has a recurrenceDays interval
// (e.g. 21 days for a haircut), and sends one reminder once that many
// days have passed since the visit — never more than once per booking.
const Booking = require("../models/Booking");
const sendNotification = require("./notify");
const { emitToRoom } = require("./socket");

async function runRevisitCheck() {
  const candidates = await Booking.find({
    status: "completed",
    revisitReminderSent: false,
    "service.recurrenceDays": { $ne: null },
  }).populate("store", "name");

  const now = Date.now();

  for (const booking of candidates) {
    const completedAt = booking.updatedAt?.getTime() || booking.createdAt.getTime();
    const dueAt = completedAt + booking.service.recurrenceDays * 24 * 60 * 60 * 1000;
    if (now < dueAt) continue;

    const storeName = booking.store?.name || "your last visit";
    const weeks = Math.round(booking.service.recurrenceDays / 7);
    const timeLabel = weeks >= 4 ? `${Math.round(weeks/4.3)} month${Math.round(weeks/4.3)>1?"s":""}` : `${weeks} week${weeks>1?"s":""}`;

    await sendNotification(
      booking.customer,
      "Time for a revisit? ✨",
      `It's been about ${timeLabel} since your ${booking.service.name} at ${storeName}. Ready to book again?`
    );
    emitToRoom(`user:${booking.customer}`, "revisit-reminder", {
      bookingId: booking._id, storeName, serviceName: booking.service.name,
    });

    booking.revisitReminderSent = true;
    await booking.save();
  }
}

module.exports = { runRevisitCheck };