// routes/bookings.js
const router = require("express").Router();
const {getAvailableSlots, createBooking, getMyBookings,
  getStoreBookings, getLiveQueue, updateStatus,
  cancelBooking, getAdminStats, verifyOtp, rescheduleBooking, updateBookingLocation, getBlockedDates, getCustomerHistory, getStoreActivity, addBlockedDate, removeBlockedDate } = require("../controllers/bookingController");
const { protect, authorize } = require("../middleware/auth");

router.get("/slots/:storeId",  protect, getAvailableSlots);
router.post("/",               protect, authorize("customer"), createBooking);
router.get("/my",              protect, authorize("customer"), getMyBookings);
router.get("/store/:storeId/customer/:phone", protect, authorize("owner","admin"), getCustomerHistory);
router.get("/store/:storeId/activity", protect, authorize("owner","admin"), getStoreActivity);
router.get("/store/blocked-dates", protect, authorize("owner"), getBlockedDates);
router.get("/store/:storeId",  protect, authorize("owner","admin"), getStoreBookings);
router.get("/queue/:storeId",  protect, getLiveQueue);
router.put("/:id/status",      protect, authorize("owner","admin"), updateStatus);
router.put("/:id/verify-otp",  protect, authorize("owner","admin"), verifyOtp);
router.put("/:id/cancel",      protect, authorize("customer"), cancelBooking);
router.put("/:id/reschedule", protect, rescheduleBooking);
router.put("/:id/location", protect, updateBookingLocation);
router.get("/admin/stats",     protect, authorize("admin"), getAdminStats);

router.post("/store/blocked-dates", protect, authorize("owner"), addBlockedDate);
router.delete("/store/blocked-dates/:date", protect, authorize("owner"), removeBlockedDate);

module.exports = router;
