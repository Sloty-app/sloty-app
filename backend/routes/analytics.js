// routes/analytics.js
const router = require("express").Router();
const { getDashboardAnalytics, getCustomersOverview, getCustomerDetail } = require("../controllers/analyticsController");
const { protect, authorize } = require("../middleware/auth");

router.get("/dashboard", protect, authorize("owner"), getDashboardAnalytics);
router.get("/admin/customers", protect, authorize("admin"), getCustomersOverview);
router.get("/admin/customers/:id", protect, authorize("admin"), getCustomerDetail);

module.exports = router;