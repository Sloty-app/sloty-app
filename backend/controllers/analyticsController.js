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

// A booking's real, realized revenue as a Mongo aggregation expression
// — original price plus any add-on services, but only counting add-ons
// actually marked paid (an unpaid add-on hasn't come in yet, so
// shouldn't inflate reported revenue ahead of when the store genuinely
// collects it). Same rule the JS version used to apply per-document
// after loading everything into Node; expressed once here so every
// $group below can $sum it directly inside the database.
const bookingRevenueExpr = {
  $add: [
    { $ifNull: ["$service.price", 0] },
    { $cond: [
        { $eq: ["$addedServicesPaymentStatus", "paid"] },
        { $sum: { $map: { input: { $ifNull: ["$addedServices", []] }, as: "x", in: { $ifNull: ["$$x.price", 0] } } } },
        0,
    ]},
  ],
};

// GET /api/analytics/dashboard?days=30
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    const days = Math.min(Number(req.query.days) || 30, 90); // cap to avoid unbounded queries
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Everything below used to start with Booking.find(...) loading
    // every matching document into Node, then computing all six chart
    // views (revenue-by-day, revenue-by-service, no-show-by-day,
    // peak-hours, staff performance) via repeated .filter()/.reduce()
    // passes over that same in-memory array — cost scaling with a
    // store's real booking volume in the window, re-run on every single
    // Analytics tab view. Replaced with one $facet aggregation that
    // computes each view's grouped totals in the database; only the
    // (small, bounded-by-days-or-distinct-groups) grouped results ever
    // reach this process.
    const [agg] = await Booking.aggregate([
      { $match: { store: store._id, createdAt: { $gte: since } } },
      { $facet: {
          revenueByDay: [
            { $match: { status: "completed" } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                revenue: { $sum: bookingRevenueExpr },
            } },
          ],
          // Add-ons are counted under their OWN name, not folded into
          // whatever was originally booked — a beard trim added onto a
          // haircut visit should show up as beard-trim revenue, not
          // haircut revenue. $concatArrays builds one entry for the
          // primary service plus one per paid add-on, then $unwind
          // fans them out so $group can sum by name across both.
          revenueByService: [
            { $match: { status: "completed" } },
            { $addFields: { _contrib: {
                $concatArrays: [
                  [{ name: { $ifNull: ["$service.name", "Unknown"] }, revenue: { $ifNull: ["$service.price", 0] } }],
                  { $cond: [
                      { $eq: ["$addedServicesPaymentStatus", "paid"] },
                      { $map: { input: { $ifNull: ["$addedServices", []] }, as: "x", in: { name: "$$x.name", revenue: { $ifNull: ["$$x.price", 0] } } } },
                      [],
                  ]},
                ],
            } } },
            { $unwind: "$_contrib" },
            { $group: { _id: "$_contrib.name", revenue: { $sum: "$_contrib.revenue" } } },
            { $sort: { revenue: -1 } },
            { $limit: 8 }, // top 8 — a full long-tail list isn't actionable
          ],
          dayCounts: [
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                total: { $sum: 1 },
                noShow: { $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] } },
            } },
          ],
          // Hour prefix parsed the same way the old regex did (the
          // digits before the ":", no AM/PM adjustment) — same behavior
          // as before, just evaluated in the database. onError/onNull
          // fall back to hour 0 instead of failing the whole query if
          // any historical row ever has a malformed timeSlot.
          peakHours: [
            { $group: {
                _id: { $convert: {
                  input: { $arrayElemAt: [{ $split: [{ $ifNull: ["$timeSlot", "0:00"] }, ":"] }, 0] },
                  to: "int", onError: 0, onNull: 0,
                } },
                count: { $sum: 1 },
            } },
          ],
          staffPerformance: [
            { $match: { status: "completed", staffName: { $nin: [null, ""] } } },
            { $group: { _id: "$staffName", bookings: { $sum: 1 }, revenue: { $sum: bookingRevenueExpr } } },
            { $sort: { revenue: -1 } },
          ],
      } },
    ]);

    // Dense zero-filled day templates — cheap (O(days), max 90), then
    // overlaid with whatever the aggregation actually found. Mongo only
    // returns days with at least one booking, so this fills the gaps
    // exactly like the old pre-seeded object did.
    const revenueByDay = {};
    const noShowByDay  = {};
    // Pre-existing bug, found while verifying this rewrite against real
    // data rather than just reading the code: counting forward from
    // `since` (exactly `days` days before the current instant) produces
    // `days` calendar-day keys ending YESTERDAY, not today — e.g. with
    // days=7 at 2026-09-05, this generated 08-29..09-04 and silently had
    // no slot for 09-05 at all, so today's activity could never appear
    // on the chart no matter how much came in, not even as a zero. Fixed
    // by counting backward from now instead, which always lands the
    // last entry on today's own calendar date.
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueByDay[key] = 0;
      noShowByDay[key]  = { total: 0, noShow: 0 };
    }
    agg.revenueByDay.forEach(r => { if (revenueByDay[r._id] !== undefined) revenueByDay[r._id] = r.revenue; });
    agg.dayCounts.forEach(r => { if (noShowByDay[r._id]) noShowByDay[r._id] = { total: r.total, noShow: r.noShow }; });

    const revenueTrend = Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue }));
    const revenueByService = agg.revenueByService.map(r => ({ name: r._id, revenue: r.revenue }));
    const noShowTrend = Object.entries(noShowByDay).map(([date, v]) => ({
      date,
      rate: v.total > 0 ? Math.round((v.noShow / v.total) * 100) : 0,
    }));
    const peakHours = agg.peakHours
      .map(r => ({ hour: r._id, count: r.count }))
      .filter(h => h.count > 0)
      .sort((a, b) => a.hour - b.hour);
    const staffPerformance = agg.staffPerformance.map(r => ({ name: r._id, bookings: r.bookings, revenue: r.revenue }));

    // New vs returning: "new" means this is the customer's first-ever
    // booking at this store (not just first in the selected window) —
    // needs each customer's full history, not just bookings in `days`.
    // .distinct() pulls only the customer ids that appear in-window
    // (bounded by that count, not by total bookings), rather than
    // extracting them from a full document array we no longer fetch.
    const customerIds = await Booking.distinct("customer", { store: store._id, createdAt: { $gte: since } });
    const firstBookingDates = await Booking.aggregate([
      { $match: { store: store._id, customer: { $in: customerIds } } },
      { $group: { _id: "$customer", firstBooking: { $min: "$createdAt" } } },
    ]);
    const firstBookingMap = new Map(firstBookingDates.map(f => [f._id.toString(), f.firstBooking]));
    let newCustomers = 0, returningCustomers = 0;
    customerIds.forEach(id => {
      const first = firstBookingMap.get(id.toString());
      if (first && new Date(first) >= since) newCustomers++;
      else returningCustomers++;
    });

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

    // The response only ever displayed the 30 most recent bookings
    // anyway (see the .slice(0,30) this replaces) — but stats and
    // favorite-store were computed by loading the customer's ENTIRE
    // booking history first. For a long-standing regular that's every
    // visit they've ever made, just to then throw away everything past
    // #30. Stats are now a single aggregation (bounded by status/store
    // group count, not by history length); only the 30 rows actually
    // shown are ever fetched as full documents.
    const [agg] = await Booking.aggregate([
      { $match: { customer: customer._id } },
      { $facet: {
          statusCounts: [
            { $group: { _id: "$status", n: { $sum: 1 } } },
          ],
          revenue: [
            { $match: { status: "completed" } },
            { $group: { _id: null, totalSpent: { $sum: { $ifNull: ["$service.price", 0] } }, completedCount: { $sum: 1 } } },
          ],
          // Favorite store = the store this customer has booked most
          // often (any status, matching the original's own count-all
          // rule) — grouped and topped-out in the database instead of
          // building a per-store tally by hand over every booking.
          favoriteStore: [
            { $match: { store: { $ne: null } } },
            { $group: { _id: "$store", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: Store.collection.name, localField: "_id", foreignField: "_id", as: "storeDoc" } },
            { $project: { count: 1, name: { $arrayElemAt: ["$storeDoc.name", 0] } } },
          ],
          totalCount: [{ $count: "n" }],
      } },
    ]);

    const statusCount = (name) => agg.statusCounts.find(s => s._id === name)?.n || 0;
    const totalSpent = agg.revenue[0]?.totalSpent || 0;
    const completedCount = agg.revenue[0]?.completedCount || 0;
    const fav = agg.favoriteStore[0];

    const recentBookings = await Booking.find({ customer: req.params.id })
      .select("store service date timeSlot status")
      .populate("store", "name")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

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
        totalBookings: agg.totalCount[0]?.n || 0,
        completed: completedCount,
        cancelled: statusCount("cancelled"),
        noShow: statusCount("no_show"),
        totalSpent,
        avgBookingValue: completedCount ? Math.round(totalSpent / completedCount) : 0,
        favoriteStore: fav ? { name: fav.name || "Unknown", count: fav.count } : null,
      },
      bookings: recentBookings.map(b => ({
        _id: b._id, storeName: b.store?.name || "Unknown", service: b.service?.name,
        price: b.service?.price, date: b.date, timeSlot: b.timeSlot, status: b.status,
      })),
    });
  } catch (err) {
    console.error("getCustomerDetail error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};