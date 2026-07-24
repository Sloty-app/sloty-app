// utils/referralSystem.js
// Generates a unique, human-friendly referral code from the user's name
// (e.g. "Charan" → "CHAR8472"). Kept short so it's easy to share verbally.
function generateReferralCode(name) {
  const prefix = (name || "USER").replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
}

module.exports = { generateReferralCode };