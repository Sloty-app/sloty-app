// routes/auth.js
const router = require("express").Router();
const {
  register, login, getMe, updateProfile, changePassword,
  toggleFavorite, getFavorites, sendOtp, verifyOtpLogin,
deleteAccount} = require("../controllers/authController");
const { googleLogin } = require("../controllers/googleAuth");
const { protect } = require("../middleware/auth");

router.post("/register",        register);
router.post("/login",           login);
router.post("/google",          googleLogin);
router.post("/send-otp",        sendOtp);        // public — phone+OTP login (customers)
router.post("/verify-otp",      verifyOtpLogin);  // public — phone+OTP login (customers)
router.get ("/me",              protect, getMe);
router.put ("/update-profile",  protect, updateProfile);
router.get ("/favorites",       protect, getFavorites);
router.put ("/favorites/:storeId", protect, toggleFavorite);

router.delete("/delete-account", protect, deleteAccount);

module.exports = router;