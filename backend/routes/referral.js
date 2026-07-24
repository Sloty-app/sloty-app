// routes/referral.js
const router = require("express").Router();
const { getMyReferral, applyReferralCode } = require("../controllers/referralController");
const { protect } = require("../middleware/auth");

router.get ("/my",    protect, getMyReferral);
router.post("/apply", protect, applyReferralCode);

module.exports = router;