// routes/settings.js
const router = require("express").Router();
const { getPublicSettings, setReferralProgramEnabled, setUpiPaymentsEnabled } = require("../controllers/settingsController");
const { protect, authorize } = require("../middleware/auth");

router.get("/public", protect, getPublicSettings);
router.put("/referral-program", protect, authorize("admin"), setReferralProgramEnabled);
router.put("/upi-payments", protect, authorize("admin"), setUpiPaymentsEnabled);

module.exports = router;