// controllers/storeController.js
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

    let stores = await Store.find(filter).populate("owner","name phone").sort({ rating:-1 }).lean();

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
exports.getStore = async (req, res) => {
  try {
    const store = await Store.findOne({ _id:req.params.id, isApproved:true }).populate("owner","name phone");
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });
    res.status(200).json({ success:true, store });
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

    req.body.owner = req.user.id;
    const exists = await Store.findOne({ owner:req.user.id, name:req.body.name });
    if (exists) return res.status(400).json({ success:false, message:"You already have a store with this name" });

    // email isn't an actual Store schema field — it's only being used
    // here to update the owner's own account, then removed before
    // creating the Store document so it doesn't get silently dropped
    // or cause a schema validation surprise.
    const ownerEmail = req.body.email.trim();
    delete req.body.email;

    const store = await Store.create(req.body);

    // Update the owner's real account email — this is what makes
    // future "New Booking" notifications actually reach them, instead
    // of silently going to their auto-generated placeholder address.
    await User.findByIdAndUpdate(req.user.id, { email: ownerEmail }, { runValidators: true }).catch(err => {
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
    const updated = await Store.findByIdAndUpdate(req.params.id, req.body, { new:true, runValidators:true });
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
    const stores = await Store.find({ isApproved:false, isActive:true }).populate("owner","name email phone").sort({ createdAt:-1 });
    res.status(200).json({ success:true, count:stores.length, stores });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/stores/admin/all — Admin sees ALL stores
exports.getAllStores = async (req, res) => {
  try {
    const stores = await Store.find({}).populate("owner","name email phone").sort({ createdAt:-1 });
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
    store.totalReviews = store.reviews.length;
    store.rating = +(store.reviews.reduce((a,r)=>a+r.rating,0)/store.reviews.length).toFixed(1);
    await store.save();
    res.status(200).json({ success:true, message:"Review added! Thank you ⭐", store });
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

    const bookings = await Booking.find({ store: req.params.id });

    const completed   = bookings.filter(b => b.status === "completed");
    const cancelled   = bookings.filter(b => b.status === "cancelled");
    const noShow      = bookings.filter(b => b.status === "no_show");
    const confirmed   = bookings.filter(b => b.status === "confirmed");

    const totalRevenue = completed.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    // Last 30 days revenue, for a "recent performance" signal separate
    // from all-time totals.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCompleted = completed.filter(b => new Date(b.createdAt) >= thirtyDaysAgo);
    const recentRevenue = recentCompleted.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    const recentBookings = [...bookings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(b => ({
        _id: b._id, customerName: b.customerName, service: b.service?.name,
        price: b.service?.price, date: b.date, timeSlot: b.timeSlot, status: b.status,
      }));

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
        totalBookings: bookings.length,
        completed: completed.length,
        cancelled: cancelled.length,
        noShow: noShow.length,
        confirmed: confirmed.length,
        totalRevenue,
        recentRevenue,
        recentBookingsCount: recentCompleted.length,
        avgBookingValue: completed.length ? Math.round(totalRevenue / completed.length) : 0,
      },
      recentBookings,
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