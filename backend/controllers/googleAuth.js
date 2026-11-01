const jwt  = require("jsonwebtoken");
const User = require("../models/User");
const { generateReferralCode } = require("../utils/referralSystem");

// Verifies a Google access token (from the frontend's useGoogleLogin hook,
// implicit flow) by fetching the user's profile directly from Google's
// userinfo endpoint, finds or creates the matching user account, and
// returns the same JWT shape as the regular email/OTP login — so the
// rest of the app treats Google-authenticated users identically.
//
// role-aware, matching the same (email/phone, role) account-separation
// model used for phone/OTP login — the same Google account can hold a
// separate customer identity AND a separate owner identity, rather
// than always resolving to whichever one was created first. Defaults
// to "customer" so the existing customer Google Sign-In button needs
// no changes; only the owner login screen needs to actually send
// role:"owner". Never trusts "admin" here, same rule as every other
// self-service signup path in this app.
exports.googleLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;
    const role = req.body.role === "owner" ? "owner" : "customer";
    if (!accessToken) return res.status(400).json({ success:false, message:"No token provided" });

    // The token must have been issued to Sloty's own Google client. The
    // userinfo endpoint below accepts a token from ANY app, so without
    // this check a token from some other site's "Sign in with Google"
    // could be replayed here to log in as that person.
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error("GOOGLE_CLIENT_ID is not set — Google sign-in is disabled until it is.");
      return res.status(503).json({ success:false, message:"Google sign-in isn't available right now" });
    }
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    const info = infoRes.ok ? await infoRes.json() : {};
    if (info.aud !== process.env.GOOGLE_CLIENT_ID && info.azp !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ success:false, message:"Invalid Google token" });
    }

    const googleRes = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!googleRes.ok) return res.status(401).json({ success:false, message:"Invalid Google token" });
    const { email: rawEmail, name, picture, id: googleId, verified_email } = await googleRes.json();
    const email = rawEmail?.toLowerCase();

    if (!email) return res.status(400).json({ success:false, message:"Google account has no email address" });
    if (verified_email === false) return res.status(400).json({ success:false, message:"Please verify your Google account's email first" });

    // An account that only TYPED this email into its profile doesn't get
    // linked to (that would hand the Google user's sign-in to whoever
    // claimed their address first). It loses the address instead, and
    // the person who just proved it gets their own account.
    await User.updateMany(
      { email, role, emailVerified: false, googleId: { $ne: googleId } },
      [{ $set: { email: { $concat: [{ $toString: "$_id" }, "@unverified.sloty.com"] } } }]
    );

    let user = await User.findOne({ email, role });
    if (!user) {
      user = await User.create({
        referralCode: generateReferralCode(name || email),
        name: name || email.split("@")[0],
        email,
        phone: null, // null (not "") so the sparse unique index correctly ignores multiple Google-only accounts
        password: require("crypto").randomBytes(20).toString("hex"), // was Math.random() — guessable, and this account can log in by password
        role,
        googleId,
        avatar: picture,
        isVerified: true,
        city: "",
      });
    } else if (!user.googleId) {
      // Existing OTP/email account (within this same role) signing in
      // with Google for the first time — link the accounts instead of
      // creating a duplicate.
      user.googleId = googleId;
      user.emailVerified = true;
      if (picture && !user.avatar) user.avatar = picture;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, city: user.city, avatar: user.avatar },
    });
  } catch (err) {
    console.error("Google auth error:", err.message);
    if (err.code === 11000) return res.status(400).json({ success:false, message:"This Google account is already registered." });
    res.status(401).json({ success:false, message:"Google sign-in failed - please try again" });
  }
};