// controllers/authController.js
const User = require("../models/User");
const { generateReferralCode } = require("../utils/referralSystem");
const jwt  = require("jsonwebtoken");

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "7d" });

const sendToken = (user, code, res, message) => {
  const token = generateToken(user._id);
  user.password = undefined;
  res.status(code).json({
    success: true, message, token,
    user: { id:user._id, name:user.name, email:user.email, phone:user.phone, role:user.role, city:user.city, area:user.area||"", isVerified:user.isVerified },
  });
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, city, area , notifPrefs, savedAddresses} = req.body;
    if (!name||!email||!phone||!password) return res.status(400).json({ success:false, message:"Please fill all fields" });
    if (await User.findOne({ email })) return res.status(400).json({ success:false, message:"Email already registered. Please login." });
    // Only allow customer or owner — never trust client-sent "admin" role
    const allowedRole = role === "owner" ? "owner" : "customer";
    if (await User.findOne({ phone, role: allowedRole })) return res.status(400).json({ success:false, message:"Phone number already registered." });

    const referralCode = generateReferralCode(req.body.name);
    const user = await User.create({
      referralCode, name, email, phone, password, role: allowedRole, city: city||"", area: area||"" });
    sendToken(user, 201, res, "Account created! Welcome to Sloty 🎉");
  } catch (err) {
    if (err.name==="ValidationError") return res.status(400).json({ success:false, message: Object.values(err.errors)[0].message });
    res.status(500).json({ success:false, message:"Server error", error: process.env.NODE_ENV==="development"?err.message:undefined });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ success:false, message:"Please provide email and password" });
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ success:false, message:"Invalid email or password" });
    if (!user.isActive) return res.status(401).json({ success:false, message:"Account deactivated. Contact support." });
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave:false });
    sendToken(user, 200, res, `Welcome back, ${user.name}! 👋`);
  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success:true, user });
  } catch (err) {
    console.error("GET ME ERROR:", err);
    res.status(500).json({ success:false, message:"Server error", detail: err.message });
  }
};

// PUT /api/auth/update-profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, city, area, avatar, phone, email, notifPrefs, savedAddresses } = req.body;
    const updates = {};
    if (name)   updates.name   = name;
    if (city)   updates.city   = city;
    if (area !== undefined) updates.area = area;
    if (avatar) updates.avatar = avatar;
    if (phone)  updates.phone  = phone;
    if (email)  updates.email  = email;
    if (notifPrefs) updates.notifPrefs = notifPrefs;
    if (savedAddresses) updates.savedAddresses = savedAddresses;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new:true, runValidators:true });
    res.status(200).json({ success:true, message:"Profile updated", user });
  } catch (err) {
    // Duplicate-key conflict — e.g. trying to set an email or phone
    // number that's already used by a different account.
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "value";
      const label = field === "email" ? "email address" : field === "phone" ? "phone number" : field;
      return res.status(400).json({ success:false, message: `This ${label} is already in use by another account.` });
    }
    // Mongoose schema validation failure — e.g. phone doesn't match
    // the required format. runValidators:true means this IS reachable
    // here.
    if (err.name === "ValidationError") {
      const firstError = Object.values(err.errors)[0];
      return res.status(400).json({ success:false, message: firstError?.message || "Invalid data provided." });
    }
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ success:false, message:"Server error", detail: err.message });
  }
};

// PUT /api/auth/change-password

// PUT /api/auth/favorites/:storeId — Toggle a store in/out of the customer's favorites
exports.toggleFavorite = async (req, res) => {
  try {
    const { storeId } = req.params;
    const user = await User.findById(req.user.id);
    const idx = user.favorites.findIndex(id => id.toString() === storeId);
    let favorited;
    if (idx > -1) {
      user.favorites.splice(idx, 1);
      favorited = false;
    } else {
      user.favorites.push(storeId);
      favorited = true;
    }
    await user.save({ validateBeforeSave:false });
    res.status(200).json({
      success: true,
      favorited,
      message: favorited ? "Added to favorites" : "Removed from favorites",
      favorites: user.favorites,
    });
  } catch (err) {
    console.error("TOGGLE FAVORITE ERROR:", err);
    res.status(500).json({ success:false, message:"Server error", detail: err.message });
  }
};

// GET /api/auth/favorites — Customer's favorited stores (full store docs)
exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "favorites",
      match: { isApproved: true, isActive: true },
    });
    res.status(200).json({ success:true, stores: user.favorites || [] });
  } catch (err) {
    console.error("GET FAVORITES ERROR:", err);
    res.status(500).json({ success:false, message:"Server error", detail: err.message });
  }
};

// ── Phone + OTP login (customers only) ──────────────────────────────────────
// Owner/Admin keep the existing email+password flow above — this is the
// passwordless path matching how Swiggy/Zomato/Practo onboard customers.
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");
const PhoneOtp = require("../models/PhoneOtp");
const { sendOtpSms } = require("../config/sms");
const { getFirebaseAuth } = require("../config/firebaseAdmin");

const OTP_COOLDOWN_MS = 45 * 1000;   // min gap between consecutive OTP requests for the same number
const OTP_EXPIRY_MS   = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// POST /api/auth/send-otp  { phone }
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    // Defaults to "customer" so the existing customer OTP flow keeps
    // working exactly as before without needing a frontend change —
    // only the owner login screen needs to actually send role:"owner".
    // Never trust "admin" here — same rule as the password-based
    // register endpoint, this can only ever create/find a customer or
    // owner account.
    const role = req.body.role === "owner" ? "owner" : "customer";

    if (!/^[6-9]\d{9}$/.test(phone||"")) {
      return res.status(400).json({ success:false, message:"Enter a valid 10-digit Indian mobile number" });
    }

    const recent = await PhoneOtp.findOne({ phone }).sort({ createdAt:-1 });
    if (recent && Date.now() - recent.createdAt.getTime() < OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
      return res.status(429).json({ success:false, message:`Please wait ${waitSec}s before requesting another OTP` });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    await PhoneOtp.create({ phone, otpHash, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) });

    const smsResult = await sendOtpSms(phone, otp);
    // Scoped to this specific role — a phone that already has a
    // customer account is still correctly "new" for the owner role,
    // since those are now two separate accounts.
    const existingUser = await User.findOne({ phone, role });

    res.status(200).json({
      success: true,
      message: smsResult.dev ? `OTP sent (dev mode — check backend terminal)` : "OTP sent to your phone",
      isNewUser: !existingUser,
      devOtp: smsResult.dev ? otp : undefined, // only present when no SMS provider is configured yet
    });
  } catch (err) {
    console.error("SEND OTP ERROR:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/auth/verify-otp  { phone, otp, name?, role? }
// If the phone already has an account within the requested role, logs
// them in. If it's a new (phone, role) combination, creates a new
// account for that role (name required). role defaults to "customer"
// so the existing customer login flow needs no frontend changes — only
// the owner login screen needs to actually send role:"owner". The same
// phone can hold a customer account AND a separate owner account; they
// are never the same login, matching the "separate accounts per role"
// approach chosen for owners who also want to book at other stores.
exports.verifyOtpLogin = async (req, res) => {
  try {
    const { phone, otp, name } = req.body;
    const role = req.body.role === "owner" ? "owner" : "customer"; // never trust "admin" here
    if (!phone || !otp) return res.status(400).json({ success:false, message:"Phone and OTP are required" });

    const record = await PhoneOtp.findOne({ phone }).sort({ createdAt:-1 });
    if (!record) return res.status(400).json({ success:false, message:"OTP expired or not requested. Please request a new one." });
    if (record.expiresAt < new Date()) {
      await PhoneOtp.deleteMany({ phone });
      return res.status(400).json({ success:false, message:"OTP expired. Please request a new one." });
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success:false, message:"Too many incorrect attempts. Please request a new OTP." });
    }

    const valid = await bcrypt.compare(otp, record.otpHash);
    if (!valid) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ success:false, message:"Incorrect OTP. Please try again." });
    }

    await PhoneOtp.deleteMany({ phone }); // OTP used — clean up

    let user = await User.findOne({ phone, role });
    let isNewAccount = false;

    if (!user) {
      if (!name || !name.trim()) {
        return res.status(400).json({ success:false, message:"Please enter your name to create an account" });
      }
      // Phone-based accounts never use email/password to sign in, but the
      // schema still requires both — fill them with safe, unique
      // placeholders. Customer placeholders keep the EXACT original
      // format (phone@sloty.com) since the frontend's placeholder-email
      // detection regex specifically matches only that pattern — adding
      // anything extra here would silently break that feature. Owner
      // placeholders use a different, still-unique domain instead, since
      // a customer and owner account on the same phone would otherwise
      // collide on email's own separate unique index.
      const placeholderEmail = role === "owner" ? `${phone}@owner.sloty.com` : `${phone}@sloty.com`;
      user = await User.create({
        name: name.trim(),
        phone,
        email: placeholderEmail,
        password: crypto.randomBytes(20).toString("hex"),
        role,
        isVerified: true,
        referralCode: generateReferralCode(name.trim()),
      });
      isNewAccount = true;
    } else {
      user.isVerified = true;
      user.lastLogin = Date.now();
      await user.save({ validateBeforeSave:false });
    }

    sendToken(user, isNewAccount ? 201 : 200, res, isNewAccount ? "Welcome to Sloty! 🎉" : `Welcome back, ${user.name}! 👋`);
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err.message);
    if (err.name === "ValidationError") return res.status(400).json({ success:false, message: Object.values(err.errors)[0].message });
    if (err.code === 11000) return res.status(400).json({ success:false, message:"This phone number is already registered." });
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/auth/firebase-login
// Called after Firebase's own client-side phone verification succeeds.
// The frontend never gets to just assert "this phone is verified" —
// it hands over the Firebase ID token, and this independently verifies
// that token against Firebase's servers before trusting the phone
// number it contains at all. Same trust boundary as Google Sign-In:
// never take the client's word for an identity claim.
exports.verifyFirebaseLogin = async (req, res) => {
  try {
    const { idToken, name } = req.body;
    const role = req.body.role === "owner" ? "owner" : "customer"; // never trust "admin" here
    if (!idToken) return res.status(400).json({ success:false, message:"Missing verification token" });

    let decoded;
    try {
      decoded = await getFirebaseAuth().verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ success:false, message:"Verification failed or expired. Please try again." });
    }

    // Firebase returns phone numbers in E.164 format (+91XXXXXXXXXX) —
    // strip the country code to match the 10-digit format used
    // everywhere else in the app (User.phone, PhoneOtp, etc.).
    const rawPhone = decoded.phone_number || "";
    const phone = rawPhone.replace(/^\+91/, "");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success:false, message:"Could not read a valid Indian phone number from verification." });
    }

    let user = await User.findOne({ phone, role });
    let isNewAccount = false;

    if (!user) {
      if (!name || !name.trim()) {
        return res.status(400).json({ success:false, message:"Please enter your name to create an account" });
      }
      // Same placeholder-email reasoning as verifyOtpLogin — phone
      // accounts have no real email at signup, but the schema still
      // requires one. Customer format must stay EXACTLY phone@sloty.com
      // since the frontend's placeholder-detection regex depends on it.
      const placeholderEmail = role === "owner" ? `${phone}@owner.sloty.com` : `${phone}@sloty.com`;
      user = await User.create({
        name: name.trim(),
        phone,
        email: placeholderEmail,
        password: crypto.randomBytes(20).toString("hex"),
        role,
        isVerified: true,
        referralCode: generateReferralCode(name.trim()),
      });
      isNewAccount = true;
    } else {
      user.isVerified = true;
      user.lastLogin = Date.now();
      await user.save({ validateBeforeSave:false });
    }

    sendToken(user, isNewAccount ? 201 : 200, res, isNewAccount ? "Welcome to Sloty! 🎉" : `Welcome back, ${user.name}! 👋`);
  } catch (err) {
    console.error("FIREBASE LOGIN ERROR:", err.message);
    if (err.name === "ValidationError") return res.status(400).json({ success:false, message: Object.values(err.errors)[0].message });
    if (err.code === 11000) return res.status(400).json({ success:false, message:"This phone number is already registered." });
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// DELETE /api/auth/delete-account — permanently removes the logged-in
// user's account and their associated data. This is destructive and
// irreversible, matching what the frontend's confirmation dialog tells
// the user before calling this.
exports.deleteAccount = async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    const Conversation = require("../models/Conversation");

    const userId = req.user.id;

    // Bookings are kept for the STORE's records (a store owner shouldn't
    // lose their booking history just because a customer deleted their
    // account) — but personally-identifying fields are scrubbed.
    await Booking.updateMany(
      { customer: userId },
      { customerName: "Deleted User", customerPhone: "" }
    );

    // Conversations involving this user are removed entirely, since
    // chat history has no ongoing business record purpose once the
    // account is gone.
    await Conversation.deleteMany({ customer: userId });

    await User.findByIdAndDelete(userId);

    res.status(200).json({ success:true, message:"Account deleted" });
  } catch (err) {
    console.error("deleteAccount error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};