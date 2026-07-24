const router = require("express").Router();
const Subscription = require("../models/Subscription");
const { protect } = require("../middleware/auth");

// Save push subscription
router.post("/subscribe", protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    await Subscription.deleteMany({ user: req.user.id });
    await Subscription.create({
      user: req.user.id,
      subscription,
      role: req.user.role,
    });
    res.status(201).json({ success: true, message: "Subscribed!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Unsubscribe
router.delete("/unsubscribe", protect, async (req, res) => {
  try {
    await Subscription.deleteMany({ user: req.user.id });
    res.status(200).json({ success: true, message: "Unsubscribed!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get VAPID public key
router.get("/vapid-key", (req, res) => {
  res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
});

module.exports = router;