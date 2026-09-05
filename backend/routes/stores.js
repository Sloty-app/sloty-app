// routes/stores.js
const router = require("express").Router();
const {
  getStores, getStore, getStoreReviews, createStore, updateStore,
  getMyStore, approveStore, rejectStore,
  getPendingStores, getAllStores, toggleOpen, addReview, getStoreAnalytics, removeStore, restoreStore,
} = require("../controllers/storeController");
const { protect, authorize } = require("../middleware/auth");

// ── PUBLIC ─────────────────────────────────────────────────
router.get("/", getStores);

// ── OWNER (specific paths before /:id) ─────────────────────
router.get("/owner/my-store", protect, authorize("owner"), getMyStore);

// ── ADMIN (specific paths before /:id) ───────────────────────
router.get("/admin/pending", protect, authorize("admin"), getPendingStores);
router.get("/admin/:id/analytics", protect, authorize("admin"), getStoreAnalytics);
router.put("/admin/:id/remove",    protect, authorize("admin"), removeStore);
router.put("/admin/:id/restore",   protect, authorize("admin"), restoreStore);
router.get("/admin/all",     protect, authorize("admin"), getAllStores);

router.get("/:id", getStore);
router.get("/:id/reviews", getStoreReviews);

// ── OWNER ──────────────────────────────────────────────────
router.post("/",               protect, authorize("owner","admin"), createStore);
router.put("/:id",             protect, updateStore);
router.put("/:id/toggle-open", protect, authorize("owner"),         toggleOpen);

// ── CUSTOMER ───────────────────────────────────────────────
router.post("/:id/reviews", protect, authorize("customer"), addReview);

// ── ADMIN ──────────────────────────────────────────────────
router.put("/:id/approve", protect, authorize("admin"), approveStore);
router.put("/:id/reject",  protect, authorize("admin"), rejectStore);

module.exports = router;
