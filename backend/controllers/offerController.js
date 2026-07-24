// controllers/offerController.js
const Offer = require("../models/Offer");
const Store = require("../models/Store");
const User  = require("../models/User");
const sendNotification = require("../config/notify");

// POST /api/offers  (owner) — creates an offer and notifies every
// customer in the store's city about it. Notification fan-out happens
// in the background (not awaited) so the owner gets an instant
// response instead of waiting on potentially hundreds of push sends.
exports.createOffer = async (req, res) => {
  try {
    const { title, description, discountType, discountValue, minBookingValue, maxDiscountAmount, applicableServices, validFrom, validUntil } = req.body;

    if (!title?.trim()) return res.status(400).json({ success:false, message:"Please give your offer a title" });
    if (!["percentage","flat"].includes(discountType)) return res.status(400).json({ success:false, message:"Invalid discount type" });
    if (!discountValue || discountValue <= 0) return res.status(400).json({ success:false, message:"Enter a valid discount amount" });
    if (discountType === "percentage" && discountValue > 90) return res.status(400).json({ success:false, message:"Percentage discount can't exceed 90%" });
    if (!validFrom || !validUntil) return res.status(400).json({ success:false, message:"Please set a valid date range" });
    if (new Date(validUntil) <= new Date(validFrom)) return res.status(400).json({ success:false, message:"End date must be after start date" });

    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"You don't have a registered store" });

    const offer = await Offer.create({
      store: store._id,
      title: title.trim(),
      description: description?.trim() || "",
      discountType,
      discountValue,
      minBookingValue: minBookingValue || 0,
      maxDiscountAmount: discountType === "percentage" ? (maxDiscountAmount || null) : null,
      applicableServices: applicableServices || [],
      validFrom,
      validUntil,
    });

    // Notify every customer whose saved city matches this store's city.
    // Fire-and-forget — don't make the owner wait on a potentially large
    // notification blast before their offer is confirmed as created.
    // Passing "offers" as the category means sendNotification itself
    // skips anyone who's turned off Offers & Promotions in Settings.
    (async () => {
      try {
        const customers = await User.find({ role: "customer", city: new RegExp(`^${store.city}$`, "i") }).select("_id");
        const discountLabel = discountType === "percentage" ? `${discountValue}% off` : `₹${discountValue} off`;
        await Promise.allSettled(
          customers.map(c => sendNotification(
            c._id,
            `🎉 New offer at ${store.name}!`,
            `${discountLabel} — ${title.trim()}. Book now before it ends!`,
            "/icon-192.png",
            "offers"
          ))
        );
        console.log(`Offer notification sent to ${customers.length} customer(s) in ${store.city}`);
      } catch (err) {
        console.error("Offer notification fan-out error:", err.message);
      }
    })();

    res.status(201).json({ success:true, message:"Offer created! Customers in your area are being notified.", offer });
  } catch (err) {
    console.error("createOffer error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/offers/owner/my-offers — all offers for the logged-in
// owner's store, regardless of active/expired status (for management).
exports.getMyOffers = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"You don't have a registered store" });
    const offers = await Offer.find({ store: store._id }).sort({ createdAt: -1 });
    res.status(200).json({ success:true, offers });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/offers/batch?storeIds=id1,id2,id3 — PUBLIC. Returns the
// single most-recent active offer per store (if any), for showing a
// discount badge directly on store list cards without needing one API
// call per card — one batched request covers the whole visible list.
exports.getBatchOffers = async (req, res) => {
  try {
    const storeIds = (req.query.storeIds || "").split(",").map(s => s.trim()).filter(Boolean);
    if (storeIds.length === 0) return res.status(200).json({ success:true, offers:{} });

    const now = new Date();
    const offers = await Offer.find({
      store: { $in: storeIds },
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    }).sort({ createdAt: -1 }); // most recently created first

    // Keep only one offer per store (the most recent) — percentage vs
    // flat discounts aren't meaningfully comparable as "bigger," so
    // recency is a simpler, unambiguous tiebreaker for a small badge.
    const bestPerStore = {};
    for (const offer of offers) {
      const key = offer.store.toString();
      if (!bestPerStore[key]) {
        bestPerStore[key] = {
          discountType: offer.discountType,
          discountValue: offer.discountValue,
          title: offer.title,
        };
      }
    }

    res.status(200).json({ success:true, offers: bestPerStore });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/offers/store/:storeId — PUBLIC. Only currently valid, active
// offers — used on the customer-facing store detail page.
exports.getStoreOffers = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      store: req.params.storeId,
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    }).sort({ createdAt: -1 });
    res.status(200).json({ success:true, offers });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/offers/:id/toggle — owner pauses/reactivates without deleting.
exports.toggleOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate("store", "owner");
    if (!offer) return res.status(404).json({ success:false, message:"Offer not found" });
    if (offer.store.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:"Not authorized" });
    offer.isActive = !offer.isActive;
    await offer.save();
    res.status(200).json({ success:true, offer });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// DELETE /api/offers/:id — owner removes an offer entirely.
exports.deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate("store", "owner");
    if (!offer) return res.status(404).json({ success:false, message:"Offer not found" });
    if (offer.store.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:"Not authorized" });
    await Offer.findByIdAndDelete(req.params.id);
    res.status(200).json({ success:true, message:"Offer deleted" });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// Helper used by bookingController to compute a discount for a given
// offer + selected services + subtotal. Exported so booking creation
// can validate and apply it server-side (never trust a client-sent
// discount amount).
exports.computeOfferDiscount = async (offerId, storeId, services, subtotal) => {
  if (!offerId) return 0;
  const offer = await Offer.findOne({ _id: offerId, store: storeId, isActive: true });
  if (!offer) return 0;

  const now = new Date();
  if (now < offer.validFrom || now > offer.validUntil) return 0;
  if (subtotal < offer.minBookingValue) return 0;

  // If the offer is scoped to specific services, at least one selected
  // service must match — otherwise the offer doesn't apply here.
  if (offer.applicableServices.length > 0) {
    const selectedNames = services.map(s => s.name);
    const matches = offer.applicableServices.some(name => selectedNames.includes(name));
    if (!matches) return 0;
  }

  let discount = offer.discountType === "flat"
    ? offer.discountValue
    : Math.round(subtotal * (offer.discountValue / 100));

  if (offer.discountType === "percentage" && offer.maxDiscountAmount) {
    discount = Math.min(discount, offer.maxDiscountAmount);
  }

  return Math.min(discount, subtotal); // never discount more than the subtotal itself
};