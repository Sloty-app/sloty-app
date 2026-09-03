// middleware/auth.js
const jwt  = require("jsonwebtoken");
const User = require("../models/User");

// Protect any route — requires valid JWT token
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return res.status(401).json({ success:false, message:"Please login to continue" });

  try {
    // Pinning the algorithm is defense-in-depth against algorithm-
    // confusion attacks (e.g. a token crafted with alg:"none" or a
    // mismatched signing scheme) — this app always signs with HS256,
    // so verification should never accept anything else.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = await User.findById(decoded.id);
    if (!req.user)       return res.status(401).json({ success:false, message:"User not found" });
    if (!req.user.isActive) return res.status(401).json({ success:false, message:"Account deactivated" });
    next();
  } catch {
    return res.status(401).json({ success:false, message:"Invalid token. Please login again" });
  }
};

// Role-based access control
// Usage: authorize("admin") or authorize("owner","admin")
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success:false, message:`Access denied for role: ${req.user.role}` });
  }
  next();
};

module.exports = { protect, authorize };
