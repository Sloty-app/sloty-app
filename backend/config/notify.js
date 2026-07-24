const webpush = require("web-push");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:sloty.app@gmail.com",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

// `category` — one of "bookingReminders" | "offers" | "chat" | undefined.
// When given, checks the recipient's notification preferences first and
// silently skips sending if they've turned that category off. Passing
// no category (or an unrecognized one) sends unconditionally — used for
// notifications that aren't one of the 3 preference toggles, like
// account-level alerts a customer shouldn't be able to fully silence.
const sendNotification = async (userId, title, body, icon="/icon-192.png", category) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.log("âš ï¸ VAPID keys not set - skipping push notification");
      return;
    }

    if (category) {
      const user = await User.findById(userId).select("notifPrefs");
      // Defaults to true if the field is missing (older accounts from
      // before preferences existed) or the category is unrecognized —
      // opting someone OUT should only ever happen from an explicit
      // false, never from an absent/unknown field.
      if (user?.notifPrefs && user.notifPrefs[category] === false) {
        console.log(`Skipped notification to ${userId} — ${category} disabled in their preferences`);
        return;
      }
    }

    const subs = await Subscription.find({ user: userId });
    if (!subs.length) return;
    const payload = JSON.stringify({ title, body, icon });
    const promises = subs.map(s =>
      webpush.sendNotification(s.subscription, payload).catch(err => {
        if (err.statusCode === 410) {
          Subscription.findByIdAndDelete(s._id);
        }
      })
    );
    await Promise.all(promises);
    console.log(`âœ… Push notification sent to user ${userId}`);
  } catch (err) {
    console.error("Push notification error:", err.message);
  }
};
module.exports = sendNotification;