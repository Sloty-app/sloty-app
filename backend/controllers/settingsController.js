// controllers/settingsController.js
const Settings = require("../models/Settings");

// GET /api/settings/public — readable by any logged-in user (customer,
// owner, or admin). Structured so more admin-toggleable settings can
// be added here later without needing a new endpoint each time.
exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      referralProgramEnabled: settings.referralProgramEnabled,
      upiPaymentsEnabled: settings.upiPaymentsEnabled,
    });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/settings/referral-program  { enabled }  — admin only.
exports.setReferralProgramEnabled = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ success:false, message:"'enabled' must be true or false" });

    const settings = await Settings.getSettings();
    settings.referralProgramEnabled = enabled;
    await settings.save();

    res.status(200).json({ success:true, message:`Referral program ${enabled ? "enabled" : "paused"}`, referralProgramEnabled: enabled });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/settings/upi-payments  { enabled }  — admin only. Controls
// whether customers see "Pay Online (UPI)" as a booking option at all —
// meant to stay off until real (non-dev-mode) Razorpay credentials are
// live, so real customers never hit a dev-mode "Simulate Payment" button.
exports.setUpiPaymentsEnabled = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ success:false, message:"'enabled' must be true or false" });

    const settings = await Settings.getSettings();
    settings.upiPaymentsEnabled = enabled;
    await settings.save();

    res.status(200).json({ success:true, message:`UPI payments ${enabled ? "enabled" : "hidden"}`, upiPaymentsEnabled: enabled });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};