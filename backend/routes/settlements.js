// routes/settlements.js
const router = require("express").Router();
const {
  getMyBalance, requestSettlement, getPendingSettlements, completeSettlement,
} = require("../controllers/settlementController");
const { protect, authorize } = require("../middleware/auth");

router.get ("/balance",       protect, authorize("owner"), getMyBalance);
router.post("/request",       protect, authorize("owner"), requestSettlement);
router.get ("/pending",       protect, authorize("admin"), getPendingSettlements);
router.put ("/:id/complete",  protect, authorize("admin"), completeSettlement);

module.exports = router;