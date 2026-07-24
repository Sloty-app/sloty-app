// controllers/referralController.js
const mongoose = require("mongoose");
const User    = require("../models/User");
const sendNotification = require("../config/notify");

const REFERRAL_REWARD   = 50; // ₹ credited to referrer when someone signs up with their code
const WELCOME_BONUS     = 50; // ₹ credited to the new user who used a referral code on signup

// GET /api/referral/my — get the current user's referral code, wallet
// balance, and how many people they've referred.
exports.getMyReferral = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("referralCode walletBalance referralCount name");
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    res.status(200).json({
      success: true,
      referralCode:   user.referralCode,
      walletBalance:  user.walletBalance,
      referralCount:  user.referralCount,
    });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/referral/apply  { code } — called when a newly registered
// user enters a referral code. Awards credit to both parties.
exports.applyReferralCode = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ success:false, message:"Please enter a referral code" });

    const newUser = await User.findById(req.user.id);
    if (!newUser) return res.status(404).json({ success:false, message:"User not found" });

    // Each user can only apply one referral code, ever.
    if (newUser.referredBy) return res.status(400).json({ success:false, message:"You've already applied a referral code" });

    // Can't use your own code.
    if (newUser.referralCode === code.trim().toUpperCase()) {
      return res.status(400).json({ success:false, message:"You can't use your own referral code" });
    }

    const referrer = await User.findOne({ referralCode: code.trim().toUpperCase() });
    if (!referrer) return res.status(404).json({ success:false, message:"Invalid referral code — please check and try again" });

    // Credit both users atomically — wrapped in a real transaction so
    // either both wallet updates succeed together, or neither does.
    // Without this, a failure between the two separate saves (network
    // blip, validation error, process crash) could leave one user
    // credited and the other not, with no way to reconcile afterward.
    session.startTransaction();
    newUser.walletBalance  += WELCOME_BONUS;
    newUser.referredBy      = referrer._id;
    await newUser.save({ session });

    referrer.walletBalance += REFERRAL_REWARD;
    referrer.referralCount += 1;
    await referrer.save({ session });

    await session.commitTransaction();

    // Notify the referrer that someone used their code. Deliberately
    // outside the transaction — a notification failure shouldn't roll
    // back money that's already been correctly credited.
    sendNotification(referrer._id, "🎉 Referral bonus!", `${newUser.name} joined Sloty using your code — you earned ₹${REFERRAL_REWARD} credit!`).catch(()=>{});

    res.status(200).json({
      success: true,
      message: `₹${WELCOME_BONUS} Sloty credit added to your wallet!`,
      walletBalance: newUser.walletBalance,
    });
  } catch (err) {
    await session.abortTransaction().catch(()=>{});
    console.error("applyReferralCode error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  } finally {
    session.endSession();
  }
};