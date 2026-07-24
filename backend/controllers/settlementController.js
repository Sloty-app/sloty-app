// controllers/settlementController.js
const Store = require("../models/Store");
const Settlement = require("../models/Settlement");

// GET /api/settlements/balance — owner's current pending balance + history
exports.getMyBalance = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    const history = await Settlement.find({ store: store._id }).sort({ createdAt:-1 }).limit(20);

    res.status(200).json({
      success: true,
      pendingBalance: store.pendingUpiBalance || 0,
      history,
    });
  } catch (err) {
    console.error("getMyBalance error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/settlements/request — owner requests a payout of their
// current pending balance. Doesn't move any money itself — creates a
// request an admin will process manually, same as any marketplace's
// early-stage payout workflow before automated split settlements.
exports.requestSettlement = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    const amount = store.pendingUpiBalance || 0;
    if (amount <= 0) {
      return res.status(400).json({ success:false, message:"No pending balance to settle" });
    }

    // Check for an existing un-fulfilled request first, so a store
    // can't accidentally create duplicate requests for the same money
    // by tapping the button more than once.
    const existing = await Settlement.findOne({ store: store._id, status:"requested" });
    if (existing) {
      return res.status(400).json({ success:false, message:"You already have a pending settlement request" });
    }

    const settlement = await Settlement.create({ store: store._id, amount, status:"requested" });
    res.status(201).json({ success:true, message:"Settlement requested", settlement });
  } catch (err) {
    console.error("requestSettlement error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/settlements/pending — ADMIN: every store's open request
exports.getPendingSettlements = async (req, res) => {
  try {
    const pending = await Settlement.find({ status:"requested" })
      .populate("store", "name city area")
      .sort({ createdAt:1 }); // oldest first — first requested, first paid
    res.status(200).json({ success:true, settlements: pending });
  } catch (err) {
    console.error("getPendingSettlements error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/settlements/:id/complete — ADMIN: mark as paid out after
// manually transferring the money to the owner's bank account outside
// the app. Deducts the settled amount from the store's pending balance.
exports.completeSettlement = async (req, res) => {
  try {
    const { note } = req.body;
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) return res.status(404).json({ success:false, message:"Settlement not found" });
    if (settlement.status === "completed") {
      return res.status(400).json({ success:false, message:"Already marked completed" });
    }

    settlement.status = "completed";
    settlement.completedAt = new Date();
    if (note) settlement.note = note;
    await settlement.save();

    await Store.findByIdAndUpdate(settlement.store, { $inc: { pendingUpiBalance: -settlement.amount } });

    res.status(200).json({ success:true, message:"Settlement marked as completed", settlement });
  } catch (err) {
    console.error("completeSettlement error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};