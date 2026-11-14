// controllers/referralController.js
const mongoose = require("mongoose");
const User    = require("../models/User");
const Booking = require("../models/Booking");
const Settings = require("../models/Settings");
const sendNotification = require("../config/notify");

const REFERRAL_REWARD   = 50; // ₹ credited to referrer when someone signs up with their code
const WELCOME_BONUS     = 50; // ₹ credited to the new user who used a referral code on signup
// A code can only be applied by a genuinely new customer: within this
// many days of signing up, and before their first booking.
const APPLY_WINDOW_DAYS = 7;

// GET /api/referral/my — the current user's referral code, wallet
// balance, how many people they've referred, and whether the program is on.
exports.getMyReferral = async (req, res) => {
  try {
    const [user, settings] = await Promise.all([
      User.findById(req.user.id).select("referralCode walletBalance referralCount name"),
      Settings.getSettings(),
    ]);
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    res.status(200).json({
      success: true,
      referralCode:   user.referralCode,
      walletBalance:  user.walletBalance,
      referralCount:  user.referralCount,
      programEnabled: !!settings.referralProgramEnabled,
    });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/referral/apply  { code } — a newly registered customer enters
// a friend's code. Both get wallet credit, which pays for real bookings, so
// every rule below is enforced here rather than trusted to the app.
exports.applyReferralCode = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ success:false, message:"Please enter a referral code" });

    const settings = await Settings.getSettings();
    if (!settings.referralProgramEnabled) {
      return res.status(403).json({ success:false, message:"The referral program isn't running right now." });
    }

    const newUser = await User.findById(req.user.id);
    if (!newUser) return res.status(404).json({ success:false, message:"User not found" });
    if (newUser.role !== "customer") return res.status(403).json({ success:false, message:"Referral codes are for customer accounts." });
    if (newUser.referredBy) return res.status(400).json({ success:false, message:"You've already applied a referral code" });
    if (newUser.referralCode === code) return res.status(400).json({ success:false, message:"You can't use your own referral code" });

    const ageDays = (Date.now() - new Date(newUser.createdAt).getTime()) / 864e5;
    if (!(ageDays <= APPLY_WINDOW_DAYS) || await Booking.exists({ customer: newUser._id })) {
      return res.status(400).json({ success:false, message:`Referral codes can only be used within ${APPLY_WINDOW_DAYS} days of joining, before your first booking.` });
    }

    const referrer = await User.findOne({ referralCode: code, role: "customer", isActive: true });
    if (!referrer) return res.status(404).json({ success:false, message:"Invalid referral code — please check and try again" });
    // Two accounts swapping codes would mint credit for both.
    if (referrer.referredBy && String(referrer.referredBy) === String(newUser._id)) {
      return res.status(400).json({ success:false, message:"You can't use the code of someone you referred." });
    }

    // Both wallets move together or not at all. The referredBy:null
    // condition makes a second, simultaneous apply match nothing.
    session.startTransaction();
    const applied = await User.findOneAndUpdate(
      { _id: newUser._id, referredBy: null },
      { $set: { referredBy: referrer._id }, $inc: { walletBalance: WELCOME_BONUS } },
      { new: true, session }
    );
    if (!applied) {
      await session.abortTransaction();
      return res.status(409).json({ success:false, message:"You've already applied a referral code" });
    }
    await User.updateOne({ _id: referrer._id }, { $inc: { walletBalance: REFERRAL_REWARD, referralCount: 1 } }, { session });
    await session.commitTransaction();

    // Outside the transaction — a notification failure shouldn't roll
    // back credit that's already been correctly given.
    sendNotification(referrer._id, "🎉 Referral bonus!", `${newUser.name} joined Sloty using your code — you earned ₹${REFERRAL_REWARD} credit!`).catch(()=>{});

    res.status(200).json({
      success: true,
      message: `₹${WELCOME_BONUS} Sloty credit added to your wallet!`,
      walletBalance: applied.walletBalance,
    });
  } catch (err) {
    await session.abortTransaction().catch(()=>{});
    // A simultaneous apply loses the transaction's write conflict.
    if (err.code === 112 || err.errorLabels?.includes?.("TransientTransactionError")) {
      return res.status(409).json({ success:false, message:"You've already applied a referral code" });
    }
    console.error("applyReferralCode error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  } finally {
    session.endSession();
  }
};
