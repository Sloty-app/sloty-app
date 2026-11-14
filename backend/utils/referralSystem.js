// utils/referralSystem.js
const crypto = require("crypto");

// No 0/O or 1/I, so a code read out loud or copied by hand stays unambiguous.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Human-friendly referral code from the user's name (e.g. "Charan" →
// "CHAR7K2Q9M"). Six random characters give ~10⁹ codes per prefix, so
// collisions are rare; the unique index on User.referralCode catches the rest.
function generateReferralCode(name) {
  const prefix = (name || "USER").replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${prefix}${suffix}`;
}

// Gives every account without a code (seeded/legacy users) one, and
// re-issues codes that are shared by more than one account (possible with
// the old 4-digit codes), then builds the unique index. Runs at startup.
async function backfillReferralCodes(User) {
  const missing = await User.find({ $or: [{ referralCode: { $exists: false } }, { referralCode: "" }, { referralCode: null }] }).select("name");
  const dupes = await User.aggregate([
    { $match: { referralCode: { $type: "string", $gt: "" } } },
    { $group: { _id: "$referralCode", ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  const reissue = [...missing.map((u) => u._id), ...dupes.flatMap((d) => d.ids.slice(1))];
  for (const id of reissue) {
    const u = await User.findById(id).select("name");
    if (u) await User.updateOne({ _id: id }, { $set: { referralCode: generateReferralCode(u.name) } });
  }
  await User.createIndexes();
  return reissue.length;
}

module.exports = { generateReferralCode, backfillReferralCodes };
