// config/noShowJob.js
//
// Runs every 30 minutes. Finds all bookings that:
//   - Are still "confirmed" (not verified via OTP → not in_progress/completed)
//   - Have a date+timeSlot that is now MORE than 30 minutes in the past
//   - Haven't already been marked as no_show
//
// Marks them as no_show, increments the customer's noShowCount, and
// applies a booking restriction if they've crossed the threshold.

const Booking = require("../models/Booking");
const User    = require("../models/User");
const { getISTDateString } = require("../utils/date");
const sendNotification = require("./notify");

const WARNING_THRESHOLD    = 3; // warn customer after this many no-shows
const RESTRICTION_THRESHOLD = 5; // restrict booking after this many no-shows
const RESTRICTION_DAYS      = 7; // how many days the restriction lasts

// Parse a "10:30 AM" time slot string and combine with a date string
// to get a JS Date in IST, then check if it's more than 30 min past.
function isSlotExpired(dateStr, timeSlot) {
  try {
    const [time, meridiem] = timeSlot.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const [year, month, day] = dateStr.split("-").map(Number);
    // IST = UTC+5:30, so slot time in UTC = slot time - 5h30m
    const slotUTC = new Date(Date.UTC(year, month - 1, day, hours - 5, minutes - 30));
    const nowUTC  = new Date();
    const diffMinutes = (nowUTC - slotUTC) / 60000;
    return diffMinutes > 30; // slot must be > 30 min in the past
  } catch {
    return false;
  }
}

// Counts one no-show against the customer, warning them and restricting
// booking at the thresholds. Shared by this job and the owner's manual
// "Mark No Show" (which previously didn't count at all).
exports.applyNoShowPenalty = async (customerId) => {
  const customer = await User.findByIdAndUpdate(customerId, { $inc: { noShowCount: 1 } }, { new: true });
  if (!customer) return false;

  if (customer.noShowCount >= RESTRICTION_THRESHOLD) {
    // A real instant: compared against new Date() at booking time, so
    // an IST-shifted base would stretch the ban by an extra 5.5 hours.
    const restrictedUntil = new Date(Date.now() + RESTRICTION_DAYS * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(customerId, { bookingRestrictedUntil: restrictedUntil });
    sendNotification(
      customerId,
      "⛔ Booking access restricted",
      `You've had ${customer.noShowCount} no-shows. Booking is restricted for ${RESTRICTION_DAYS} days. Please be mindful of your bookings.`
    ).catch(() => {});
  } else if (customer.noShowCount >= WARNING_THRESHOLD) {
    sendNotification(
      customerId,
      "⚠️ No-show warning",
      `You've missed ${customer.noShowCount} bookings without cancelling. After ${RESTRICTION_THRESHOLD} no-shows, you'll be restricted from booking for ${RESTRICTION_DAYS} days.`
    ).catch(() => {});
  }
  return true;
};

exports.runNoShowCheck = async () => {
  try {
    // Every still-confirmed booking dated today or earlier — not just
    // today/yesterday. The old two-day window silently skipped bookings
    // forever whenever the server was asleep or down when they expired
    // (e.g. a free-tier host spinning down overnight), leaving them stuck
    // as "confirmed". "YYYY-MM-DD" strings compare correctly as text.
    const candidates = await Booking.find({
      status: "confirmed",
      date:   { $lte: getISTDateString() },
    }).select("_id customer store date timeSlot status");

    let noShowCount = 0;

    for (const booking of candidates) {
      if (!isSlotExpired(booking.date, booking.timeSlot)) continue;

      // Conditional on still being "confirmed" — if the owner verified
      // the customer's OTP in the meantime, this matches nothing and the
      // customer isn't wrongly penalised.
      const marked = await Booking.findOneAndUpdate({ _id: booking._id, status: "confirmed" }, { status: "no_show" });
      if (!marked) continue;

      if (await exports.applyNoShowPenalty(booking.customer)) noShowCount++;
    }

    if (noShowCount > 0) {
      console.log(`No-show job: marked ${noShowCount} booking(s) as no_show`);
    }
  } catch (err) {
    console.error("No-show job error:", err.message);
  }
};