// controllers/analyticsController.js
//
// One consolidated endpoint rather than several small ones — keeps
// this to a single MongoDB round trip and a single aggregation pass
// over the store's bookings, instead of the owner's dashboard firing
// off 5-6 separate requests.
const Store = require("../models/Store");
const Booking = require("../models/Booking");
const User = require("../models/User");
const mongoose = require("mongoose");

// GET /api/analytics/dashboard?days=30
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    const days = Math.min(Number(req.query.days) || 30, 90); // cap to avoid unbounded queries
    const since = new Date();
    since.setDate(since.getDate() - days);

    const bookings = await Booking.find({
      store: store._id,
      createdAt: { $gte: since },
    }).select("customer service staffName timeSlot status paymentMode createdAt date addedServices addedServicesPaymentStatus");

    // A booking's real, realized revenue — original price plus any
    // add-on services, but only counting add-ons that were actually
    // marked paid. An unpaid add-on hasn't actually come in yet, so it
    // shouldn't inflate reported revenue ahead of when the store
    // genuinely collects it.
    const bookingRevenue = (b) => {
      const base = b.service?.price || 0;
      const addOns = b.addedServicesPaymentStatus === "paid"
        ? (b.addedServices || []).reduce((sum, s) => sum + (s.price || 0), 0)
        : 0;
      return base + addOns;
    };

    // ── Revenue trend (completed bookings only — reflects money that
    //    actually came in, not pending/cancelled ones) ──────────────────
    const revenueByDay = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      revenueByDay[d.toISOString().slice(0,10)] = 0;
    }
    bookings.filter(b => b.status === "completed").forEach(b => {
      const key = new Date(b.createdAt).toISOString().slice(0,10);
      if (revenueByDay[key] !== undefined) revenueByDay[key] += bookingRevenue(b);
    });
    const revenueTrend = Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue }));

    // ── Revenue by service ───────────────────────────────────────────────
    const serviceRevenue = {};
    bookings.filter(b => b.status === "completed").forEach(b => {
      const name = b.service?.name || "Unknown";
      serviceRevenue[name] = (serviceRevenue[name] || 0) + (b.service?.price || 0);
      // Add-ons counted under their OWN name, not folded into whatever
      // was originally booked — a beard trim added onto a haircut visit
      // should show up as beard-trim revenue, not haircut revenue.
      if (b.addedServicesPaymentStatus === "paid") {
        (b.addedServices || []).forEach(s => {
          serviceRevenue[s.name] = (serviceRevenue[s.name] || 0) + (s.price || 0);
        });
      }
    });
    const revenueByService = Object.entries(serviceRevenue)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a,b) => b.revenue - a.revenue)
      .slice(0, 8); // top 8 — a full long-tail list isn't actionable

    // ── New vs returning customers ───────────────────────────────────────
    // "New" = this is the customer's first-ever booking at this store
    // (not just first in the selected window) — requires checking each
    // customer's full history, not just bookings within `days`.
    const customerIds = [...new Set(bookings.map(b => b.customer?.toString()).filter(Boolean))];
    const firstBookingDates = await Booking.aggregate([
      { $match: { store: store._id, customer: { $in: customerIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: "$customer", firstBooking: { $min: "$createdAt" } } },
    ]);
    const firstBookingMap = new Map(firstBookingDates.map(f => [f._id.toString(), f.firstBooking]));
    let newCustomers = 0, returningCustomers = 0;
    customerIds.forEach(id => {
      const first = firstBookingMap.get(id);
      if (first && new Date(first) >= since) newCustomers++;
      else returningCustomers++;
    });

    // ── No-show trend ─────────────────────────────────────────────────────
    const noShowByDay = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      noShowByDay[d.toISOString().slice(0,10)] = { total: 0, noShow: 0 };
    }
    bookings.forEach(b => {
      const key = new Date(b.createdAt).toISOString().slice(0,10);
      if (!noShowByDay[key]) return;
      noShowByDay[key].total += 1;
      if (b.status === "no_show") noShowByDay[key].noShow += 1;
    });
    const noShowTrend = Object.entries(noShowByDay).map(([date, v]) => ({
      date,
      rate: v.total > 0 ? Math.round((v.noShow / v.total) * 100) : 0,
    }));

    // ── Peak hours — bookings grouped by hour-of-day, across the window ──
    const hourCounts = Array(24).fill(0);
    bookings.forEach(b => {
      const hourMatch = (b.timeSlot || "").match(/^(\d{1,2}):/);
      if (hourMatch) hourCounts[Number(hourMatch[1])] += 1;
    });
    const peakHours = hourCounts.map((count, hour) => ({ hour, count })).filter(h => h.count > 0);

    // ── Staff performance (only meaningful for multi-staff stores) ──────
    let staffPerformance = [];
    if (store.hasStaff) {
      const staffStats = {};
      bookings.filter(b => b.status === "completed" && b.staffName).forEach(b => {
        if (!staffStats[b.staffName]) staffStats[b.staffName] = { bookings: 0, revenue: 0 };
        staffStats[b.staffName].bookings += 1;
        staffStats[b.staffName].revenue += bookingRevenue(b);
      });
      staffPerformance = Object.entries(staffStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a,b) => b.revenue - a.revenue);
    }

    res.status(200).json({
      success: true,
      days,
      revenueTrend,
      revenueByService,
      customers: { new: newCustomers, returning: returningCustomers },
      noShowTrend,
      peakHours,
      staffPerformance,
      hasStaff: store.hasStaff,
    });
  } catch (err) {
    console.error("getDashboardAnalytics error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/analytics/admin/customers?search=&sort=bookings|spent|recent&page=&limit=
// Admin-wide customer list with per-customer booking stats. Every
// customer is included (even those with zero bookings so the admin
// sees the true signup count), joined with an aggregate over ALL
// bookings — sorting/totals are correct app-wide, not just within the
// current page.
exports.getCustomersOverview = async (req, res) => {
  try {
    const { search = "", sort = "bookings" } = req.query;
    const page  = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const userFilter = { role: "customer" };
    if (search.trim()) {
      // Escaped so a search string containing regex metacharacters
      // (e.g. a phone number with a "+", or any of . * + ? ( ) etc.)
      // is matched literally instead of being interpreted as a pattern.
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      userFilter.$or = [{ name: re }, { phone: re }, { email: re }];
    }

    const sortStage =
      sort === "spent"  ? { totalSpent:    -1 } :
      sort === "recent" ? { joinedAt:      -1 } :
                          { totalBookings: -1 }; // default: most active first

    // Global totals are deliberately NOT scoped to the search box —
    // matches the previous behaviour, where the summary row stayed a
    // platform-wide figure while only the list beneath it responded to
    // search. Computed once, in the database, instead of loading every
    // booking ever made (system-wide) into Node to reduce over — the
    // part of the old code that scaled worst, since it re-ran in full
    // on every single page load of this screen regardless of search or
    // pagination.
    const [totalCustomers, [globalStats], [pipelineResult]] = await Promise.all([
      User.countDocuments(userFilter),
      Booking.aggregate([
        { $group: {
            _id: "$customer",
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$service.price", 0] } },
        } },
        { $group: {
            _id: null,
            activeCustomers: { $sum: 1 }, // one group row per distinct customer with >=1 booking
            totalBookingsAll: { $sum: "$totalBookings" },
            totalSpentAll: { $sum: "$totalSpent" },
        } },
      ]),
      // Per-customer stats, joined and paginated entirely in the
      // database — replaces fetching every matching user, building a
      // JS Map of every booking grouped by customer, and sorting/
      // slicing the merged result in Node.
      User.aggregate([
        { $match: userFilter },
        { $lookup: {
            from: Booking.collection.name,
            let: { uid: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$customer", "$$uid"] } } },
              { $group: {
                  _id: null,
                  totalBookings: { $sum: 1 },
                  completed:  { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                  cancelled:  { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
                  noShow:     { $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] } },
                  totalSpent: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$service.price", 0] } },
                  lastBookingAt: { $max: "$createdAt" },
              } },
            ],
            as: "stats",
        } },
        { $addFields: { stats: { $ifNull: [{ $arrayElemAt: ["$stats", 0] }, {}] } } },
        { $project: {
            name:1, phone:1, email:1, city:1, area:1, isActive:1, walletBalance:1, referralCount:1,
            joinedAt: "$createdAt",
            totalBookings: { $ifNull: ["$stats.totalBookings", 0] },
            completed:     { $ifNull: ["$stats.completed", 0] },
            cancelled:     { $ifNull: ["$stats.cancelled", 0] },
            noShow:        { $ifNull: ["$stats.noShow", 0] },
            totalSpent:    { $ifNull: ["$stats.totalSpent", 0] },
            lastBookingAt: { $ifNull: ["$stats.lastBookingAt", null] },
        } },
        { $facet: {
            paged: [
              { $sort: sortStage },
              { $skip: (page - 1) * limit },
              { $limit: limit },
            ],
            totalCount: [{ $count: "n" }],
        } },
      ]),
    ]);

    const customers = (pipelineResult?.paged || []).map(u => ({
      _id: u._id, name: u.name, phone: u.phone, email: u.email,
      city: u.city, area: u.area, joinedAt: u.joinedAt, isActive: u.isActive,
      walletBalance: u.walletBalance, referralCount: u.referralCount,
      totalBookings: u.totalBookings, completed: u.completed, cancelled: u.cancelled,
      noShow: u.noShow, totalSpent: u.totalSpent, lastBookingAt: u.lastBookingAt,
    }));
    const matchedCount = pipelineResult?.totalCount?.[0]?.n || 0;
    const totalBookingsAllCustomers = globalStats?.totalBookingsAll || 0;
    const totalSpentAllCustomers    = globalStats?.totalSpentAll || 0;

    res.status(200).json({
      success: true,
      totals: {
        totalCustomers,
        activeCustomers: globalStats?.activeCustomers || 0,
        totalBookings: totalBookingsAllCustomers,
        totalSpent: totalSpentAllCustomers,
        avgBookingsPerCustomer: totalCustomers ? +(totalBookingsAllCustomers / totalCustomers).toFixed(1) : 0,
      },
      count: matchedCount,
      page, limit,
      customers,
    });
  } catch (err) {
    console.error("getCustomersOverview error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/analytics/admin/customers/:id — one customer's full booking history + stats
exports.getCustomerDetail = async (req, res) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: "customer" });
    if (!customer) return res.status(404).json({ success:false, message:"Customer not found" });

    const bookings = await Booking.find({ customer: req.params.id })
      .populate("store", "name category city area")
      .sort({ createdAt: -1 });

    const completed = bookings.filter(b => b.status === "completed");
    const cancelled = bookings.filter(b => b.status === "cancelled");
    const noShow    = bookings.filter(b => b.status === "no_show");
    const totalSpent = completed.reduce((sum, b) => sum + (b.service?.price || 0), 0);

    // Favorite store = the store this customer has booked most often.
    const storeCounts = {};
    bookings.forEach(b => {
      if (!b.store) return;
      const key = b.store._id.toString();
      if (!storeCounts[key]) storeCounts[key] = { name: b.store.name, count: 0 };
      storeCounts[key].count++;
    });
    const favoriteStore = Object.values(storeCounts).sort((a, b) => b.count - a.count)[0] || null;

    res.status(200).json({
      success: true,
      customer: {
        _id: customer._id, name: customer.name, phone: customer.phone, email: customer.email,
        city: customer.city, area: customer.area, joinedAt: customer.createdAt,
        walletBalance: customer.walletBalance, referralCount: customer.referralCount,
        isActive: customer.isActive, noShowCount: customer.noShowCount,
        bookingRestrictedUntil: customer.bookingRestrictedUntil,
      },
      stats: {
        totalBookings: bookings.length, completed: completed.length,
        cancelled: cancelled.length, noShow: noShow.length, totalSpent,
        avgBookingValue: completed.length ? Math.round(totalSpent / completed.length) : 0,
        favoriteStore,
      },
      bookings: bookings.slice(0, 30).map(b => ({
        _id: b._id, storeName: b.store?.name || "Unknown", service: b.service?.name,
        price: b.service?.price, date: b.date, timeSlot: b.timeSlot, status: b.status,
      })),
    });
  } catch (err) {
    console.error("getCustomerDetail error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};