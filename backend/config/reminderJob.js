// config/reminderJob.js — location-aware "time to head out" reminders
const Booking = require("../models/Booking");
const sendNotification = require("./notify");
const { sendBookingReminderWhatsApp } = require("./whatsapp");
const { getISTNow, getISTDateString } = require("../utils/date");
const { emitToRoom } = require("./socket");

const BUFFER_MINUTES = 12; // extra cushion on top of estimated travel time (covers the "10-15 min" ask)

/** Parse "10:30 AM" + IST "today" into minutes-from-midnight for comparison */
function slotToMinutes(timeSlot) {
  const [timePart, period] = timeSlot.split(" ");
  const [h, m] = timePart.split(":").map(Number);
  let hour24 = h % 12;
  if (period === "PM") hour24 += 12;
  return hour24 * 60 + m;
}

async function runReminderCheck() {
  const today = getISTDateString();
  const now = getISTNow();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const dueBookings = await Booking.find({
    date: today,
    status: "confirmed",
    reminderSent: false,
  })
    .populate("store", "name address city")
    .populate("customer", "name phone notifPrefs");

  for (const booking of dueBookings) {
    const slotMinutes = slotToMinutes(booking.timeSlot);
    const travelMinutes = booking.estimatedTravelMinutes ?? 15; // sensible default if location wasn't captured
    const notifyAtMinutes = slotMinutes - travelMinutes - BUFFER_MINUTES;

    // Fire once we've reached the notify window, but not if the slot has already passed
    if (nowMinutes >= notifyAtMinutes && nowMinutes < slotMinutes) {
      const storeName = booking.store?.name || "your appointment";
      const leadTime = travelMinutes + BUFFER_MINUTES;
      const customerId = booking.customer?._id || booking.customer;

      // Respect the SAME "booking reminders" preference across both
      // channels — someone who's turned these off shouldn't still get
      // a WhatsApp message just because that's a separate code path
      // from the push notification.
      const remindersEnabled = booking.customer?.notifPrefs?.bookingReminders !== false;

      if (remindersEnabled) {
        await sendNotification(
          customerId,
          "Time to head out! 🚗",
          `Your slot at ${storeName} is in about ${leadTime} min (including travel time). Token: ${booking.tokenNumber}`,
          "/icon-192.png",
          "bookingReminders"
        );

        if (booking.customer?.phone) {
          await sendBookingReminderWhatsApp(
            booking.customer.phone,
            booking.customer.name || "there",
            storeName,
            booking.timeSlot,
            booking.tokenNumber
          );
        }
      }

      emitToRoom(`user:${customerId}`, "reminder", {
        bookingId: booking._id,
        storeName,
        timeSlot: booking.timeSlot,
      });
      booking.reminderSent = true;
      await booking.save();
    }
  }
}

module.exports = { runReminderCheck };