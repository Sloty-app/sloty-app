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
  // Closed: nothing in the app uses it (customers/owners sign up by phone
  // OTP or Google, admins are created by script), and it created accounts
  // with any unverified phone/email — a way to pre-claim someone's
  // identity before they join.
  res.status(410).json({ success:false, message:"Please sign up with your phone number." });
};

// A phone number just proven by OTP takes precedence over an account
// that only typed it into its profile: that account loses the number
// (it was never theirs to prove) instead of being logged into.
const releaseUnverifiedPhone = (phone, role) =>
  User.updateMany({ phone, role, phoneVerified: false }, { $set: { phone: null }, $unset: { phoneVerified: 1 } });

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ success:false, message:"Please provide email and password" });
    // An email can belong to more than one account (one per role — e.g.
    // a Google-linked owner and a separate admin on the same address).
    // findOne({ email }) would just take whichever came first and then
    // fail the password check against the wrong one, locking the admin
    // out. Look at every account with this email and sign in the one
    // whose password actually matches; admin is tried first since this
    // endpoint is the admin page's login.
    const candidates = await User.find({ email }).select("+password");
    candidates.sort((a, b) => (b.role === "admin") - (a.role === "admin"));
    let user = null;
    for (const c of candidates) {
      if (await c.comparePassword(password)) { user = c; break; }
    }
    if (!user) return res.status(401).json({ success:false, message:"Invalid email or password" });
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
    res.status(500).json({ success:false, message:"Server error", detail: process.env.NODE_ENV==="development"?err.message:undefined });
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
    // Typed-in contact details aren't proven, so they're flagged — a later
    // OTP/Google login proving the same number/email wins over this claim
    // (see releaseUnverifiedPhone and googleLogin).
    if (phone && phone !== req.user.phone) { updates.phone = phone; updates.phoneVerified = false; }
    if (email && String(email).toLowerCase().trim() !== req.user.email) { updates.email = email; updates.emailVerified = false; }
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
    res.status(500).json({ success:false, message:"Server error", detail: process.env.NODE_ENV==="development"?err.message:undefined });
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
    res.status(500).json({ success:false, message:"Server error", detail: process.env.NODE_ENV==="development"?err.message:undefined });
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
    res.status(500).json({ success:false, message:"Server error", detail: process.env.NODE_ENV==="development"?err.message:undefined });
  }
};

// ── Phone login ─────────────────────────────────────────────────────────────
// Phone numbers are verified by Firebase on the device; the backend only
// checks Firebase's ID token (below). Owner/Admin also have email+password.
const crypto   = require("crypto");
const { getFirebaseAuth } = require("../config/firebaseAdmin");

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
    // everywhere else in the app (User.phone etc.).
    const rawPhone = decoded.phone_number || "";
    const phone = rawPhone.replace(/^\+91/, "");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success:false, message:"Could not read a valid Indian phone number from verification." });
    }

    await releaseUnverifiedPhone(phone, role);
    let user = await User.findOne({ phone, role });
    let isNewAccount = false;

    if (!user) {
      if (!name || !name.trim()) {
        return res.status(400).json({ success:false, message:"Please enter your name to create an account" });
      }
      // Phone accounts have no real email at signup, but the schema
      // still requires one. Customer format must stay EXACTLY phone@sloty.com
      // since the frontend's placeholder-detection regex depends on it.
      const placeholderEmail = role === "owner" ? `${phone}@owner.sloty.com` : `${phone}@sloty.com`;
      try {
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
      } catch (createErr) {
        // Two near-simultaneous first-time logins for the same phone
        // can both pass the findOne() above before either finishes
        // creating — a genuine, if rare, race. When this happens the
        // account now legitimately exists (the other request just won
        // it by microseconds), so re-fetch and let this login succeed
        // normally rather than surfacing a "already registered" error
        // to someone who's just trying to log in for the first time.
        if (createErr.code === 11000) {
          user = await User.findOne({ phone, role });
          if (!user) throw createErr; // genuinely something else — let outer handler deal with it
        } else {
          throw createErr;
        }
      }
    } else {
      user.isVerified = true;
      user.phoneVerified = true;
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
    const Store = require("../models/Store");
    const SlotCapacity = require("../models/SlotCapacity");
    const Subscription = require("../models/Subscription");

    // Upcoming bookings would otherwise keep holding their slots (and
    // show on the owner's queue) for someone who no longer exists.
    const upcoming = await Booking.find({ customer: userId, status: "confirmed" });
    for (const b of upcoming) {
      const claimed = await Booking.findOneAndUpdate({ _id: b._id, status: "confirmed" }, { status: "cancelled", cancelReason: "Customer deleted their account" });
      if (claimed && !b.staffId) await SlotCapacity.releaseFor(b);
    }

    // A deleted owner's store can't take or serve bookings: hide it, then
    // cancel and refund its customers' upcoming visits.
    if (req.user.role === "owner") {
      const stores = await Store.find({ owner: userId }).select("_id");
      await Store.updateMany({ owner: userId }, { isActive: false, isOpen: false, removedAt: new Date() });
      await require("../utils/storeClosure").cancelStoreBookings(stores.map(s => s._id), "The store closed its Sloty account");
    }
    await Subscription.deleteMany({ user: userId });

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