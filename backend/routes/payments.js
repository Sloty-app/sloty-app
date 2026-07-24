// routes/payments.js
const router = require("express").Router();
const { createOrder, verifyPayment, switchToCash } = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

router.post("/create-order",    protect, createOrder);
router.post("/verify",          protect, verifyPayment);
router.put ("/switch-to-cash",  protect, switchToCash);

module.exports = router;