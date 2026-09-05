// controllers/storeController.js
const mongoose = require("mongoose");
const Store = require("../models/Store");
const User  = require("../models/User");
const { sendEmail, emailTemplates } = require("../config/mailer");

// GET /api/stores — Public: Only APPROVED stores visible to customers
exports.getStores = async (req, res) => {
  try {
    const { category, city, search, rating, lat, lng } = req.query;
    const filter = { isApproved:true, isActive:true };
    if (category) filter.category = category;
    if (city)     filter.city = new RegExp(city, "i");
    if (search)   filter.name = new RegExp(search, "i");
    if (rating)   filter.rating = { $gte: Number(rating) };

    // Excludes reviews — this is the Home/Explore list, loaded far more
    // often than any single store's detail page, and only ever shows
    // the aggregate rating/totalReviews numbers, never review text.
    // Without this, every store's full (and ever-growing) reviews array
    // shipped on every list load regardless of whether anyone opens a
    // store's Reviews tab.
    let stores = await Store.find(filter).select("-reviews").populate("owner","name phone").sort({ rating:-1 }).lean();

    // Nearest-first: only kicks in when the customer's location is passed.
    // Stores without a saved location are pushed to the end, not dropped.
    if (lat && lng) {
      const { haversineKm } = require("../utils/geo");
      stores = stores.map(s => ({
        ...s,
        distanceKm: (s.location?.lat && s.location?.lng)
          ? +haversineKm(Number(lat), Number(lng), s.location.lat, s.location.lng).toFixed(1)
          : null,
      }));
      stores.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    res.status(200).json({ success:true, count:stores.length, stores });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/stores/:id — Public: Single store (must be approved)
// Excludes reviews — the detail page's Reviews tab shows a handful at
// a time via getStoreReviews below, so there's no reason for a store
// with hundreds of reviews to ship every one of them just to render
// the Services tab (the page customers land on first).
exports.getStore = async (req, res) => {
  try {
    const store = await Store.findOne({ _id:req.params.id, isApproved:true }).select("-reviews").populate("owner","name phone");
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    res.status(200).json({ success:true, store });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/stores/:id/reviews?page=&limit= — Public: paginated reviews,
// most recent first, for the detail page's Reviews tab. Reviews are
// appended in submission order, so "most recent" means slicing from
// the END of the array — done here with $reverseArray + $slice inside
// an aggregation pipeline (the plain query-projection $slice only
// takes literal skip/limit and always counts from the front) so
// MongoDB does the reversing and paging itself and only the one
// requested page ever leaves the database, not the whole array.
exports.getStoreReviews = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const skip  = (page - 1) * limit;

    let storeObjectId;
    try { storeObjectId = new mongoose.Types.ObjectId(req.params.id); }
    catch { return res.status(400).json({ success:false, message:"Invalid store id" }); }

    const [store] = await Store.aggregate([
      { $match: { _id: storeObjectId, isApproved: true } },
      { $project: {
          rating: 1,
          totalReviews: 1,
          reviews: { $slice: [{ $reverseArray: "$reviews" }, skip, limit] },
      }},
    ]);
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    res.status(200).json({
      success:true, reviews: store.reviews || [], rating: store.rating, totalReviews: store.totalReviews,
      page, hasMore: skip + limit < (store.totalReviews || 0),
    });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// Matches the exact placeholder formats used for phone+OTP signups —
// customer accounts get {phone}@sloty.com, owner accounts get
// {phone}@owner.sloty.com. A store owner submitting registration with
// either of these means they never actually entered a real email
// anywhere, which is exactly the gap being closed here.
const isPlaceholderEmail = (email) => /^\d{10}@(owner\.)?sloty\.com$/i.test(email || "");

// Fields an owner is allowed to set on their own store. Everything else
// on the Store schema (isApproved, pendingUpiBalance, owner, rating,
// approvedBy/approvedAt, removedAt/removedBy, totalBookings, reviews...)
// is either admin-controlled or system-computed — accepting the raw
// request body here would let an owner self-approve their own store or
// forge other status/audit fields via a crafted request.
const OWNER_STORE_FIELDS = [
  "name", "category", "description", "phone", "whatsapp", "address",
  "city", "area", "pincode", "location", "services", "hasStaff",
  "slotCapacity", "staff", "workingHours", "slotDuration",
  "maxAdvanceBooking", "breakTimes", "isOpen", "photos",
];

const pickOwnerStoreFields = (body) => {
  const out = {};
  for (const key of OWNER_STORE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
};

// POST /api/stores — Owner registers their store
exports.createStore = async (req, res) => {
  try {
    // A real, working email is required at this step specifically —
    // this is the one moment every owner reliably passes through
    // (unlike Settings, which is easy to skip), and it's the email
    // that "New Booking" notifications actually depend on working.
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success:false, message:"Please enter your email address" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success:false, message:"Enter a valid email address" });
    }
    if (isPlaceholderEmail(email.trim())) {
      return res.status(400).json({ success:false, message:"Please enter your real email address, not an auto-generated one" });
    }

    const exists = await Store.findOne({ owner:req.user.id, name:req.body.name });
    if (exists) return res.status(400).json({ success:false, message:"You already have a store with this name" });

    // Only whitelisted fields make it onto the document — status/audit
    // fields like isApproved, pendingUpiBalance, and owner are always
    // set here explicitly, never taken from the request body.
    const store = await Store.create({
      ...pickOwnerStoreFields(req.body),
      owner: req.user.id,
    });

    // Update the owner's real account email — this is what makes
    // future "New Booking" notifications actually reach them, instead
    // of silently going to their auto-generated placeholder address.
    await User.findByIdAndUpdate(req.user.id, { email: email.trim() }, { runValidators: true }).catch(err => {
      // A duplicate-email collision here is a genuine edge case (this
      // email already used by another account) — logged, but doesn't
      // block store registration itself from succeeding.
      console.error("Could not update owner email during store registration:", err.message);
    });

    // Notify every admin that a new store needs review — fire-and-
    // forget, same reasoning as booking notifications: this is a
    // side effect of registration succeeding, not something that
    // should slow down or risk the actual registration response.
    (async () => {
      try {
        const admins = await User.find({ role: "admin" }).select("email name");
        const template = emailTemplates.newStorePendingAdmin(store.name, req.user.name, store.category, store.city);
        await Promise.all(
          admins.filter(a => a.email).map(a => sendEmail(a.email, template.subject, template.html))
        );
      } catch (notifyErr) {
        console.error("Admin notification error (store still registered):", notifyErr.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: "Store registered! ⏳ Waiting for admin approval. We will notify you soon.",
      store,
    });
  } catch (err) {
    if (err.name==="ValidationError") return res.status(400).json({ success:false, message: Object.values(err.errors)[0].message });
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/stores/:id — Owner updates their store
exports.updateStore = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    if (store.owner.toString()!==req.user.id && req.user.role!=="admin") return res.status(403).json({ success:false, message:"Not authorized" });
    // Owners only ever get the whitelisted fields applied — status/audit
    // fields stay admin-only. Admins updating a store through this same
    // route (e.g. support edits) get the same restriction; approving a
    // store is a separate, dedicated admin action, not a generic PUT.
    const updated = await Store.findByIdAndUpdate(req.params.id, pickOwnerStoreFields(req.body), { new:true, runValidators:true });
    res.status(200).json({ success:true, message:"Store updated", store:updated });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/stores/owner/my-store — Owner sees their own store
exports.getMyStore = async (req, res) => {
  try {
    const store = await Store.findOne({ owner:req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"You have not registered a store yet" });
    res.status(200).json({ success:true, store });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/stores/:id/approve — Admin approves a store
exports.approveStore = async (req, res) => {
  try {
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { isApproved:true, approvedBy:req.user.id, approvedAt:Date.now(), rejectedReason:"" },
      { new:true }
    );
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    // Fire-and-forget — the approval itself is already saved above.
    // The admin tapping "Approve" shouldn't wait on an SMTP round-trip
    // (which is exactly what was making this feel slow, and likely
    // why it only appeared approved after a manual refresh — the
    // request just hadn't actually finished yet by the time it looked
    // like nothing happened).
    (async () => {
      try {
        const owner = await User.findById(store.owner);
        if (owner?.email) {
          const template = emailTemplates.storeApproved(owner.name, store.name);
          await sendEmail(owner.email, template.subject, template.html);
        }
      } catch (notifyErr) {
        console.error("Store-approval email error (approval still saved):", notifyErr.message);
      }
    })();

    res.status(200).json({ success:true, message:`✅ "${store.name}" approved!`, store });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/stores/:id/reject — Admin rejects a store
exports.rejectStore = async (req, res) => {
  try {
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { isApproved:false, isActive:false, rejectedReason: req.body.reason||"Does not meet requirements" },
      { new:true }
    );
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    res.status(200).json({ success:true, message:`❌ "${store.name}" rejected.`, store });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/stores/admin/pending — Admin sees all pending stores
exports.getPendingStores = async (req, res) => {
  try {
    const stores = await Store.find({ isApproved:false, isActive:true }).populate("owner","name email phone").sort({ createdAt:-1 }).lean();
    res.status(200).json({ success:true, count:stores.length, stores });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/stores/admin/all — Admin sees ALL stores
exports.getAllStores = async (req, res) => {
  try {
    // .limit(1000) is a safety cap — every store on the platform, no
    // real deployment is anywhere near that yet, but this stops the
    // admin dashboard's full-store-list call from becoming a genuine
    // problem once it eventually is.
    const stores = await Store.find({}).populate("owner","name email phone").sort({ createdAt:-1 }).limit(1000).lean();
    res.status(200).json({ success:true, count:stores.length, stores });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/stores/:id/toggle-open — Owner opens/closes store
exports.toggleOpen = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    if (store.owner.toString()!==req.user.id) return res.status(403).json({ success:false, message:"Not authorized" });
    store.isOpen = !store.isOpen;
    await store.save();
    res.status(200).json({ success:true, message:`Store is now ${store.isOpen?"🟢 Open":"🔴 Closed"}`, isOpen:store.isOpen });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/stores/:id/reviews — Customer adds review
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    const alreadyReviewed = store.reviews.find(r=>r.user.toString()===req.user.id);
    if (alreadyReviewed) return res.status(400).json({ success:false, message:"You already reviewed this store" });
    store.reviews.push({ user:req.user.id, name:req.user.name, rating, comment });
    // ratingSum is a running total backing the average — updating it
    // with plain arithmetic means the new average never needs to
    // re-reduce the whole (and only ever growing) reviews array. Stores
    // that predate this field have ratingSum unset (not defaulted to
    // 0 — see the schema comment), so the first review after this
    // change reconstructs it once from the existing rating*totalReviews
    // instead of silently discarding every review that came before it.
    const priorSum = store.ratingSum ?? (store.rating * store.totalReviews);
    store.ratingSum = priorSum + rating;
    store.totalReviews += 1;
    store.rating = +(store.ratingSum / store.totalReviews).toFixed(1);
    await store.save();
    // Reviews left off the response on purpose — the client already
    // has the review it just submitted; there's no reason to also ship
    // every other review back just to confirm one write succeeded.
    const { reviews, ...storeWithoutReviews } = store.toObject();
    res.status(200).json({ success:true, message:"Review added! Thank you ⭐", store: storeWithoutReviews });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/stores/admin/:id/analytics
// Returns everything an admin needs to examine one store: booking
// counts by status, real revenue (from completed bookings only —
// never trust totalBookings alone for money), rating, recent activity.
exports.getStoreAnalytics = async (req, res) => {
  try {
    const Store   = require("../models/Store");
    const Booking = require("../models/Booking");

    const store = await Store.findById(req.params.id).populate("owner", "name email phone");
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    // A booking's real, realized revenue — original price plus any
    // add-on services, but only counting add-ons actually marked paid
    // (an unpaid add-on hasn't been collected yet, so shouldn't inflate
    // reported revenue ahead of when the store genuinely receives it).
    // Same rule as before, just expressed as a Mongo aggregation
    // expression instead of a JS function, so it runs once per matching
    // document inside the database instead of after pulling every
    // booking this store has ever had into the app to filter/reduce
    // over in JS — that used to mean loading a store's entire, only
    // ever growing history on every single analytics view.
    const bookingTotalExpr = {
      $add: [
        { $ifNull: ["$service.price", 0] },
        { $cond: [
            { $eq: ["$addedServicesPaymentStatus", "paid"] },
            { $sum: { $map: { input: { $ifNull: ["$addedServices", []] }, as: "x", in: { $ifNull: ["$$x.price", 0] } } } },
            0,
        ]},
      ],
    };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [agg] = await Booking.aggregate([
      { $match: { store: new mongoose.Types.ObjectId(req.params.id) } },
      { $facet: {
          totalCount:   [{ $count: "n" }],
          statusCounts: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          revenue:      [
            { $match: { status: "completed" } },
            { $group: { _id: null, totalRevenue: { $sum: bookingTotalExpr }, completedCount: { $sum: 1 } } },
          ],
          recent: [
            { $match: { status: "completed", createdAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: null, recentRevenue: { $sum: bookingTotalExpr }, recentBookingsCount: { $sum: 1 } } },
          ],
          recentBookings: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            { $project: { customerName:1, service:1, date:1, timeSlot:1, status:1 } },
          ],
      }},
    ]);

    const statusCount = (name) => agg.statusCounts.find(s => s._id === name)?.n || 0;
    const totalRevenue = agg.revenue[0]?.totalRevenue || 0;
    const completedCount = agg.revenue[0]?.completedCount || 0;

    res.status(200).json({
      success: true,
      store: {
        _id: store._id, name: store.name, category: store.category,
        city: store.city, area: store.area, phone: store.phone,
        rating: store.rating, totalReviews: store.totalReviews,
        isApproved: store.isApproved, isOpen: store.isOpen, isActive: store.isActive,
        photos: store.photos, createdAt: store.createdAt,
        owner: store.owner,
      },
      stats: {
        totalBookings: agg.totalCount[0]?.n || 0,
        completed: completedCount,
        cancelled: statusCount("cancelled"),
        noShow:    statusCount("no_show"),
        confirmed: statusCount("confirmed"),
        totalRevenue,
        recentRevenue: agg.recent[0]?.recentRevenue || 0,
        recentBookingsCount: agg.recent[0]?.recentBookingsCount || 0,
        avgBookingValue: completedCount ? Math.round(totalRevenue / completedCount) : 0,
      },
      recentBookings: agg.recentBookings.map(b => ({
        _id: b._id, customerName: b.customerName, service: b.service?.name,
        price: b.service?.price, date: b.date, timeSlot: b.timeSlot, status: b.status,
      })),
    });
  } catch (err) {
    console.error("getStoreAnalytics error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/stores/admin/:id/remove
// Soft-deletes a store (sets isActive: false) rather than a hard DB
// delete — this preserves booking history, reviews, and analytics for
// records, while making the store invisible everywhere on the customer
// side immediately (the existing getStores filter already excludes
// isActive:false stores, so no other changes are needed for that part).
exports.removeStore = async (req, res) => {
  try {
    const Store = require("../models/Store");
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { isActive: false, removedAt: new Date(), removedBy: req.user.id },
      { new: true }
    );
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    res.status(200).json({ success:true, message:`${store.name} has been removed and is no longer visible to customers.` });
  } catch (err) {
    console.error("removeStore error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/stores/admin/:id/restore
// Undo — reactivates a previously removed store.
exports.restoreStore = async (req, res) => {
  try {
    const Store = require("../models/Store");
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { isActive: true, removedAt: null, removedBy: null },
      { new: true }
    );
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    res.status(200).json({ success:true, message:`${store.name} has been restored and is visible to customers again.` });
  } catch (err) {
    console.error("restoreStore error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};