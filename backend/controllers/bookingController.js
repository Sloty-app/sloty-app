// controllers/bookingController.js
const mongoose = require("mongoose");
const crypto   = require("crypto");
const Booking  = require("../models/Booking");
const Store    = require("../models/Store");
const SlotCapacity = require("../models/SlotCapacity");
const User     = require("../models/User");
const Activity = require("../models/Activity");
const { computeOfferDiscount } = require("./offerController");
const sendNotification = require("../config/notify");
const { sendBookingConfirmationWhatsApp } = require("../config/whatsapp");
const { sendEmail, emailTemplates } = require("../config/mailer");
const { getISTNow, getISTDateString } = require("../utils/date");
const { emitToRoom } = require("../config/socket");
const { haversineKm, estimateTravelMinutes } = require("../utils/geo");

// Helper: generate time slots between open & close
// Converts "9:00 AM" / "2:30 PM" style strings to minutes-since-midnight.
// Needed for real time-range math (e.g. does adding a service push this
// booking's actual end time past when the next booking starts) rather
// than comparing time strings alphabetically, which sorts incorrectly.
const timeToMinutes = (t) => {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const generateSlots = (open, close, duration) => {
  const slots = [];
  let [h, m] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const closeTotal = ch*60+cm;
  while (h*60+m < closeTotal) {
    const period = h>=12?"PM":"AM";
    const dh = h>12?h-12:h===0?12:h;
    const dm = m===0?"00":String(m).padStart(2,"0");
    slots.push(`${dh}:${dm} ${period}`);
    m += duration;
    if (m>=60){ h+=Math.floor(m/60); m=m%60; }
  }
  return slots;
};

// GET /api/bookings/slots/:storeId?date=YYYY-MM-DD&staffId=...
exports.getAvailableSlots = async (req, res) => {
  try {
    const { date, staffId } = req.query;
    if (!date) return res.status(400).json({ success:false, message:"Date is required (?date=YYYY-MM-DD)" });
    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    const duration = parseInt(req.query.duration) || store.slotDuration || 30;
    const allSlots = generateSlots(store.workingHours.open, store.workingHours.close, duration);

    const breakRanges = (store.breakTimes || []).map(b => {
      const [bh, bm] = b.open.split(":").map(Number);
      const [ch, cm] = b.close.split(":").map(Number);
      return { start: bh*60+bm, end: ch*60+cm, label: b.label||"Break" };
    });

    const blockedEntry = (store.blockedSlots || []).find(b => b.date === date);
    // An entry with no specific slots listed means the WHOLE day is
    // closed (e.g. a festival holiday) — every generated slot for this
    // date gets blocked, rather than none, which is what an empty
    // array would otherwise mean. An entry with specific slots listed
    // blocks only those (e.g. owner stepping out 2-4pm).
    const isWholeDayClosed = !!blockedEntry && (!blockedEntry.slots || blockedEntry.slots.length === 0);
    const blockedSet = new Set(isWholeDayClosed ? allSlots : (blockedEntry?.slots || []));

    const bookedFilter = { store:req.params.storeId, date, status:{ $in:["confirmed","in_progress"] } };
    bookedFilter.staffId = (store.hasStaff && staffId) ? staffId : null;

    const booked    = await Booking.find(bookedFilter).select("timeSlot service");
    const bookedSet = new Set(booked.map(b => b.timeSlot));

    const bookedRanges = booked.map(b => {
      const [timePart, period] = b.timeSlot.split(" ");
      const [h, m] = timePart.split(":").map(Number);
      let hour24 = h;
      if (period === "PM" && h !== 12) hour24 = h + 12;
      if (period === "AM" && h === 12) hour24 = 0;
      const start = hour24 * 60 + Number(m);
      const end   = start + (b.service?.duration || duration);
      return { start, end };
    });

    const istNow = getISTNow();
    const currentTotal = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
    const today  = getISTDateString(istNow);
    const isToday = date === today;

    // Pooled-capacity stores (no named staff) can hold more than one
    // booking in the same slot, up to store.slotCapacity — so "how many
    // existing bookings overlap this slot" needs to be counted, not
    // just checked as a yes/no. Named-staff bookings (a specific
    // staffId was requested) keep the original strict 1-per-slot logic,
    // since one named person can only serve one customer at a time.
    const usingPooledCapacity = !(store.hasStaff && staffId);
    const capacity = usingPooledCapacity ? (store.slotCapacity || 1) : 1;

    const slots = allSlots.map(time => {
      const [timePart, period] = time.split(" ");
      const [h, m] = timePart.split(":").map(Number);
      let hour24 = h;
      if (period === "PM" && h !== 12) hour24 = h + 12;
      if (period === "AM" && h === 12) hour24 = 0;
      const slotTotal = hour24 * 60 + Number(m);

      const isPast   = isToday && slotTotal <= currentTotal;
      const slotEnd  = slotTotal + duration;
      const overlappingCount = bookedRanges.filter(r => slotTotal < r.end && slotEnd > r.start).length;
      const isFull   = overlappingCount >= capacity;
      const isBreak  = breakRanges.some(r => slotTotal >= r.start && slotTotal < r.end);
      const breakLabel = breakRanges.find(r => slotTotal >= r.start && slotTotal < r.end)?.label || "Break";
      const isBlocked = blockedSet.has(time);

      return {
        time,
        available: !isFull && !isPast && !isBreak && !isBlocked,
        isPast, isBooked: isFull, isBreak, isBlocked, breakLabel,
        spotsLeft: usingPooledCapacity ? Math.max(0, capacity - overlappingCount) : undefined,
      };
    }).filter(s => !s.isPast); // drop past slots entirely instead of just graying them out

    res.status(200).json({
      success:true, date, isToday,
      totalSlots:slots.length, availableCount:slots.filter(s=>s.available).length, slots,
      isWholeDayClosed,
      closureReason: blockedEntry?.reason || null,
    });
  } catch (err) {
    console.error("SLOTS ERROR:", err.message);
    res.status(500).json({ success:false, message:"Server error", error: process.env.NODE_ENV==="development"?err.message:undefined });
  }
};

// POST /api/bookings — Customer books a slot
// body.staffId is optional. body.customerLocation ({lat,lng}) is optional —
// used to estimate travel time for the location-aware "time to head out" reminder.
exports.createBooking = async (req, res) => {
  try {
    const { storeId, services, date, timeSlot, notes, paymentMode, staffId, customerLocation } = req.body;
    let { useWallet, offerId } = req.body;
    const store = await Store.findById(storeId);
    if (!store)            return res.status(404).json({ success:false, message:"Store not found" });
    if (!store.isApproved) return res.status(400).json({ success:false, message:"Store is not available" });
    if (!store.isOpen)     return res.status(400).json({ success:false, message:"Store is currently closed" });

    // Check if this customer has an active no-show restriction
    const customerCheck = await User.findById(req.user.id).select("bookingRestrictedUntil noShowCount");
    if (customerCheck?.bookingRestrictedUntil && new Date() < new Date(customerCheck.bookingRestrictedUntil)) {
      const until = new Date(customerCheck.bookingRestrictedUntil).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
      return res.status(403).json({ success:false, message:`Your booking access is restricted until ${until} due to repeated no-shows. Please cancel bookings in advance if you can't make it.` });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success:false, message:"Please select at least one service" });
    }

    // Validate every requested service against the store's CURRENT service
    // list (never trust price/duration sent from the client) and build the
    // itemized breakdown + combined summary from that authoritative data.
    const serviceBreakdown = [];
    let hasVariablePriceService = false;
    for (const reqSvc of services) {
      const matched = store.services.find(s => s.name === reqSvc.name);
      if (!matched) return res.status(400).json({ success:false, message:`"${reqSvc.name}" is no longer offered by this store. Please update your selection.` });
      if (matched.isPriceVariable) hasVariablePriceService = true;
      // Variable-price services have no fixed amount to sum — default
      // to 0 rather than undefined, which would otherwise turn the
      // total into NaN the moment reduce() hits it.
      serviceBreakdown.push({ name: matched.name, price: matched.isPriceVariable ? 0 : matched.price, duration: matched.duration, isPriceVariable: !!matched.isPriceVariable });
    }

    // A service whose price can't be known upfront (car PPF, bike
    // repairs needing unidentified spare parts) can't reasonably use
    // prepayment, wallet credit, or an offer discount — none of those
    // make sense against an unknown amount. Enforced server-side, not
    // just hidden in the UI, since payment method is never trusted
    // from the client alone.
    if (hasVariablePriceService) {
      if (paymentMode === "upi") {
        return res.status(400).json({ success:false, message:"This booking includes a service with variable pricing — online prepayment isn't available. Please choose Pay at Store." });
      }
      useWallet = false;
      offerId = null;
    }

    const totalPrice    = serviceBreakdown.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = serviceBreakdown.reduce((sum, s) => sum + s.duration, 0);
    const combinedName  = serviceBreakdown.map(s => s.name).join(" + ");

    // Apply an offer discount if one was selected — always recomputed
    // server-side from the real offer record, never trusting a
    // client-sent discount amount.
    const offerDiscount = await computeOfferDiscount(offerId, storeId, serviceBreakdown, totalPrice);
    const priceAfterOffer = totalPrice - offerDiscount;
    // Revisit reminder only makes sense for a single, repeatable service —
    // combining services makes the "right" interval ambiguous, so skip it.
    const recurrenceDays = serviceBreakdown.length === 1
      ? (store.services.find(s => s.name === serviceBreakdown[0].name)?.recurrenceDays ?? null)
      : null;

    let staffName = "";
    let resolvedStaffId = null;
    if (store.hasStaff && staffId) {
      const staffMember = store.staff.find(s => s._id.toString() === staffId && s.isActive);
      if (!staffMember) return res.status(400).json({ success:false, message:"That staff member is no longer available. Please choose another." });
      staffName = staffMember.name;
      resolvedStaffId = staffMember._id;
    }

    // Named-staff mode: a specific person can only serve one customer
    // at a time, so any existing booking for them at this slot blocks
    // it outright — same as before. Pooled-capacity mode (no named
    // staff) skips this pre-check entirely; capacity is enforced
    // instead by the atomic SlotCapacity reservation further down,
    // which correctly allows multiple concurrent bookings up to the
    // store's configured capacity rather than blocking after just one.
    if (resolvedStaffId) {
      const slotTaken = await Booking.findOne({ store:storeId, date, timeSlot, staffId: resolvedStaffId, status:{ $in:["confirmed","in_progress"] } });
      if (slotTaken) return res.status(400).json({ success:false, message:"This slot is already booked. Please choose another time." });
    }

    const todayCount  = await Booking.countDocuments({ store:storeId, date, staffId: resolvedStaffId, status:{ $in:["confirmed","in_progress","completed"] } });
    const tokenNumber = Booking.generateToken(todayCount);
    const otp         = crypto.randomInt(1000, 10000).toString(); // CSPRNG — this OTP gates in-person visit verification

    // Estimate travel time from customer's location (captured once, at booking
    // time) to the store's location, so the reminder job knows how early to
    // notify this specific customer.
    let estimatedTravelMinutes = null;
    if (customerLocation?.lat && customerLocation?.lng && store.location?.lat && store.location?.lng) {
      const distanceKm = haversineKm(customerLocation.lat, customerLocation.lng, store.location.lat, store.location.lng);
      estimatedTravelMinutes = estimateTravelMinutes(distanceKm);
    }

    // Pre-compute wallet deduction so it can be persisted on the booking
    // document itself — not just returned in the response — making it
    // visible in booking history screens without a separate lookup.
    let walletDeductedAmount = 0;
    let customerForWallet = null;
    if (useWallet) {
      customerForWallet = await User.findById(req.user.id);
      if (customerForWallet && customerForWallet.walletBalance > 0) {
        walletDeductedAmount = Math.min(customerForWallet.walletBalance, priceAfterOffer);
      }
    }

    // Everything that represents "the booking happened" — creating the
    // booking record itself, incrementing the store's counter, and
    // deducting wallet credit — is wrapped in one transaction. Without
    // this, a failure between steps (e.g. wallet deduction succeeding
    // but something after it throwing) could leave a booking on record
    // with money silently deducted and no consistent way to reconcile,
    // or vice versa. Notifications/emails stay outside deliberately —
    // those are non-critical side effects that shouldn't roll back a
    // booking that's already correctly committed.
    const session = await mongoose.startSession();
    let booking, walletDeducted = 0;
    try {
      session.startTransaction();

      // Pooled-capacity mode: atomically reserve one "seat" in this
      // slot. Succeeds only if fewer than the store's configured
      // capacity are already booked here — if capacity is full, this
      // throws a duplicate-key error (caught below and translated into
      // a friendly "slot full" message), the same pattern already used
      // for named-staff double-booking prevention.
      if (!resolvedStaffId) {
        await SlotCapacity.findOneAndUpdate(
          { store: storeId, date, timeSlot, bookedCount: { $lt: store.slotCapacity || 1 } },
          { $inc: { bookedCount: 1 }, $setOnInsert: { store: storeId, date, timeSlot } },
          { upsert: true, session }
        );
      }

      [booking] = await Booking.create([{
        customer:      req.user.id,
        store:         storeId,
        service:       { name: combinedName, price: priceAfterOffer, originalPrice: totalPrice, offerDiscount, duration: totalDuration, recurrenceDays },
        offerApplied:  offerDiscount > 0 ? offerId : null,
        serviceBreakdown,
        staffId:       resolvedStaffId,
        staffName,
        date,
        timeSlot,
        notes:         notes||"",
        paymentMode:   paymentMode||"cash",
        customerName:  req.user.name,
        customerPhone: req.user.phone,
        queuePosition: todayCount+1,
        tokenNumber,
        otp,
        walletDeducted: walletDeductedAmount,
        customerLocation: customerLocation?.lat ? { lat: customerLocation.lat, lng: customerLocation.lng } : undefined,
        estimatedTravelMinutes,
      }], { session });

      await Store.findByIdAndUpdate(storeId, { $inc:{ totalBookings:1 } }, { session });

      if (walletDeductedAmount > 0 && customerForWallet) {
        walletDeducted = walletDeductedAmount;
        customerForWallet.walletBalance -= walletDeducted;
        await customerForWallet.save({ session });
      }

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction().catch(()=>{});
      throw txErr; // handled by the outer catch (incl. duplicate-slot detection)
    } finally {
      session.endSession();
    }

    const populated = await Booking.findById(booking._id).populate("store","name address phone city category location");

    // Real-time: tell the owner's dashboard and anyone else watching this
    // store/day's queue that something changed, instantly (no polling wait).
    emitToRoom(`store:${storeId}:${date}`, "queue:update", { reason:"new_booking" });
    emitToRoom(`user:${store.owner}`, "booking:new", {
      storeId, customerName: req.user.name, service: combinedName, timeSlot, tokenNumber,
    });

    // Notifications are deliberately fire-and-forget from here on — the
    // booking itself is already safely committed above (the transaction
    // already succeeded). None of this — push notifications, emails,
    // WhatsApp — should hold up the response the customer is waiting on.
    // Previously these were all individually awaited in sequence, which
    // meant every booking silently waited on 2 SMTP email sends plus 2
    // push notifications, one after another, before the customer ever
    // saw their confirmation — easily several extra seconds for
    // something that has nothing to do with whether the booking itself
    // succeeded. A failure in any of these is only logged, never
    // surfaced to the customer, since the booking is already done.
    (async () => {
      try {
        const owner = await User.findById(store.owner);
        const withStaff = staffName ? ` with ${staffName}` : "";
        await sendNotification(req.user.id, "Slot Confirmed! 🎉", `Your slot at ${store.name}${withStaff} is confirmed! Token: ${tokenNumber} | Time: ${timeSlot}`);
        const custTemplate = emailTemplates.bookingConfirmedCustomer(req.user.name, store.name, date, timeSlot, tokenNumber, combinedName, priceAfterOffer);
        await sendEmail(req.user.email, custTemplate.subject, custTemplate.html);
        await sendNotification(store.owner, "New Booking! 🔔", `New booking from ${req.user.name}${withStaff} | Service: ${combinedName} | Time: ${timeSlot} | Token: ${tokenNumber}`);
        Activity.create({
          store: store._id,
          type: "booking_created",
          title: "New Booking",
          message: `${req.user.name}${withStaff} booked ${combinedName} for ${date} · ${timeSlot}`,
          booking: booking._id,
        }).catch(()=>{});
        if (owner?.email) {
          const ownerTemplate = emailTemplates.newBookingOwner(owner.name, req.user.name, req.user.phone, store.name, date, timeSlot, tokenNumber, combinedName, priceAfterOffer);
          await sendEmail(owner.email, ownerTemplate.subject, ownerTemplate.html);
        }
        if (req.user.phone) {
          sendBookingConfirmationWhatsApp(req.user.phone, req.user.name, store.name, date, timeSlot, tokenNumber, otp).catch(()=>{});
        }
      } catch(notifyErr) {
        console.error("Notification error (booking still saved):", notifyErr.message);
      }
    })();

    res.status(201).json({ success:true, message:`Slot booked! Your token: ${tokenNumber} 🎉`, booking: populated, walletDeducted });
  } catch (err) {
    // Duplicate-key error from the unique index means two requests raced
    // for the same slot — the second one lost cleanly at the DB level.
    if (err.code === 11000 && err.message.includes("no_double_booking")) {
      return res.status(400).json({ success:false, message:"This slot was just taken by someone else. Please choose another time." });
    }
    // Same race-condition pattern, but for pooled-capacity stores —
    // this fires when the slot's configured capacity is already full.
    if (err.code === 11000 && err.message.includes("one_counter_per_slot")) {
      return res.status(400).json({ success:false, message:"This slot is fully booked. Please choose another time." });
    }
    console.error("BOOKING ERROR:", err.message);
    res.status(500).json({ success:false, message:"Server error", error: process.env.NODE_ENV==="development"?err.message:undefined });
  }
};

// GET /api/bookings/my — Customer's own bookings
// page/limit are optional — omitting them returns the first (most
// recent) 200, which covers every real customer's full history today;
// the params exist so this stays fast once someone has years of
// bookings, without changing behavior for anyone below that size.
exports.getMyBookings = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 200);
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const bookings = await Booking.find({ customer:req.user.id })
      .populate("store","name address phone city category location")
      .sort({ createdAt:-1 })
      .skip((page-1)*limit)
      .limit(limit)
      .lean();
    res.status(200).json({ success:true, count:bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/bookings/store/:storeId?date=YYYY-MM-DD&from=...&to=...
exports.getStoreBookings = async (req, res) => {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });
    if (store.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const { date, from, to } = req.query;
    const filter = { store: req.params.storeId };
    if (date) {
      filter.date = date;
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    }
    // otp is excluded — it exists so the OWNER can verify the customer
    // physically showed up by asking them to say/enter it, so it must
    // never be readable from the owner's own dashboard.
    // .limit(500) is a safety cap, not a real pagination UI — a
    // date-filtered query (the normal case for this tab) never gets
    // close to it; it just stops an unfiltered "show everything" call
    // from pulling a store's entire multi-year history into memory.
    const bookings = await Booking.find(filter).select("-otp").populate("customer", "name phone").sort({ date: -1, timeSlot: 1 }).limit(500).lean();

    // Lifetime visit count per customer at this store — deliberately NOT
    // limited to the date range just queried, since "is this a repeat
    // customer" should reflect their real history, not just however many
    // of their bookings happen to fall inside whatever window the
    // Bookings/Queue/Dashboard tab currently asked for. Scoped to only
    // the phones actually present in this result set, so this stays a
    // single cheap aggregation regardless of how large the store's full
    // history is.
    const uniquePhones = [...new Set(bookings.map(b => b.customerPhone).filter(Boolean))];
    let visitCounts = {};
    if (uniquePhones.length > 0) {
      const counts = await Booking.aggregate([
        { $match: { store: store._id, customerPhone: { $in: uniquePhones } } },
        { $group: { _id: "$customerPhone", count: { $sum: 1 } } },
      ]);
      visitCounts = Object.fromEntries(counts.map(c => [c._id, c.count]));
    }
    // .lean() docs are already plain objects (no .toObject() to call).
    const bookingsWithVisits = bookings.map(b => ({
      ...b,
      customerVisitCount: visitCounts[b.customerPhone] || 1,
    }));

    res.status(200).json({ success: true, count: bookingsWithVisits.length, bookings: bookingsWithVisits });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/bookings/store/:storeId/customer/:phone — a specific
// customer's full booking history at this store, most recent first.
// Deliberately unbounded by date — the whole point is seeing their real
// history (past no-shows, what they usually book), not just whatever's
// in the currently-loaded 7-day/30-day window.
exports.getCustomerHistory = async (req, res) => {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });
    if (store.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const bookings = await Booking.find({ store: req.params.storeId, customerPhone: req.params.phone })
      .select("-otp")
      .sort({ date: -1, timeSlot: -1 })
      .limit(300) // safety cap only — no real customer has anywhere near this many visits at one store
      .lean();

    res.status(200).json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/bookings/store/:storeId/activity — recent activity feed
// (new bookings, cancellations) for the owner's dashboard. Exists
// specifically because push notifications are fire-and-forget — if an
// owner's phone was silent or the app was closed, there's otherwise no
// way to see what happened while they were away. Capped at 50 most
// recent entries; this is a quick-glance feed, not a full audit log.
exports.getStoreActivity = async (req, res) => {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });
    if (store.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const activity = await Activity.find({ store: req.params.storeId }).sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/bookings/queue/:storeId?staffId=... — Live queue for today (IST)
exports.getLiveQueue = async (req, res) => {
  try {
    const { staffId } = req.query;
    const today  = getISTDateString();
    const filter = { store:req.params.storeId, date:today, status:{ $in:["confirmed","in_progress"] } };
    if (staffId) filter.staffId = staffId;
    const bookings = await Booking.find(filter)
      .select("tokenNumber timeSlot status customerName queuePosition staffId staffName").sort({ queuePosition:1 });
    res.status(200).json({
      success:true,
      waiting:    bookings.filter(b=>b.status==="confirmed").length,
      inProgress: bookings.filter(b=>b.status==="in_progress").length,
      queue:      bookings,
    });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/bookings/:id/status — Owner updates booking status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate("store", "name owner");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.store?.owner?.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    booking.status = status;
    if (status === "completed") booking.paymentStatus = "paid";
    await booking.save();

    // A no-show frees up the pooled-capacity slot it was occupying,
    // same reasoning as cancellation — the customer never showed, so
    // that "seat" should become bookable by someone else. completed/
    // in_progress are the normal lifecycle of a legitimately-used slot
    // and correctly do NOT free it (the slot really was used).
    if (status === "no_show" && !booking.staffId) {
      await SlotCapacity.updateOne(
        { store: booking.store._id, date: booking.date, timeSlot: booking.timeSlot, bookedCount: { $gt: 0 } },
        { $inc: { bookedCount: -1 } }
      );
    }

    // Real-time: push the change to the owner's queue view + the specific
    // customer instantly (replaces the old 20s polling for this).
    emitToRoom(`store:${booking.store._id}:${booking.date}`, "queue:update", { reason:"status_change", bookingId: booking._id, status });
    emitToRoom(`user:${booking.customer}`, "booking:status", { bookingId: booking._id, status, storeName: booking.store?.name });

    const messages = {
      in_progress:{ title:"Your turn! 🎯",      body:`Your service at ${booking.store?.name} has started!` },
      completed:  { title:"Service Complete! ✅", body:`Your visit to ${booking.store?.name} is complete. Thank you!` },
      no_show:    { title:"Booking Missed ❌",    body:`You missed your slot at ${booking.store?.name}` },
    };
    if (messages[status]) {
      // Fire-and-forget — same reasoning as createBooking: the status
      // change is already saved above, so an owner tapping "Start
      // Service"/"Mark Complete"/"No Show" shouldn't wait on an email
      // send before seeing the button respond.
      (async () => {
        try {
          await sendNotification(booking.customer, messages[status].title, messages[status].body);
          const customer = await User.findById(booking.customer);
          if (customer?.email) {
            const template = emailTemplates.bookingStatusUpdate(customer.name, booking.store?.name, status, booking.tokenNumber);
            await sendEmail(customer.email, template.subject, template.html);
          }
        } catch (notifyErr) {
          console.error("Status notification error (status still saved):", notifyErr.message);
        }
      })();
    }

    res.status(200).json({ success:true, message:`Booking marked as ${status}`, booking });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/bookings/:id/add-service
// Owner adds an extra service mid-visit — e.g. customer came in for a
// haircut, barber recommends a beard trim too. Deliberately kept
// separate from the original serviceBreakdown/paymentStatus, since the
// original booking may already be paid (via UPI) and retroactively
// modifying a completed payment isn't practical — this is billed and
// collected as its own, independent add-on instead.
exports.addServiceToBooking = async (req, res) => {
  try {
    const { serviceName } = req.body;
    if (!serviceName) return res.status(400).json({ success:false, message:"Please specify which service to add" });

    const booking = await Booking.findById(req.params.id).populate("store", "name owner services");
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });
    if (booking.store?.owner?.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success:false, message:"Not authorized" });
    }
    if (booking.status === "completed" || booking.status === "cancelled" || booking.status === "no_show") {
      return res.status(400).json({ success:false, message:"Can't add a service to a booking that's already finished or cancelled" });
    }

    const matched = booking.store.services.find(s => s.name === serviceName);
    if (!matched) return res.status(400).json({ success:false, message:"This service is no longer offered by the store" });

    // Guards against an accidental double-tap creating two identical
    // entries — a genuine repeat add of the same service later in the
    // visit is still allowed, this only catches ones within a few
    // seconds of each other, which is what a double-tap looks like.
    const justAdded = booking.addedServices.find(s => s.name === matched.name && (Date.now() - new Date(s.addedAt).getTime()) < 5000);
    if (justAdded) {
      return res.status(200).json({ success:true, message:"Service added", booking, slotWarning:null });
    }

    booking.addedServices.push({
      name: matched.name,
      price: matched.isFree ? 0 : (matched.isPriceVariable ? 0 : matched.price),
      duration: matched.duration,
    });
    await booking.save();

    // Customer wasn't told anything about this before now — a real gap,
    // since an add-on directly changes what they owe. Fire-and-forget,
    // same pattern as every other status-change notification here.
    sendNotification(booking.customer, "Service Added ➕", `${matched.name} was added to your visit at ${booking.store.name} — ₹${matched.isFree ? 0 : matched.price}, payable at the store.`).catch(()=>{});

    // Slot-conflict check — informational only, does not block the
    // add. Real salons handle running a few minutes over informally
    // all the time; the goal here is just to give the owner a heads
    // up, not to prevent them from actually serving the customer in
    // front of them.
    let slotWarning = null;
    const originalDuration = booking.serviceBreakdown.reduce((sum, s) => sum + (s.duration || 0), 0);
    const addedDuration = booking.addedServices.reduce((sum, s) => sum + (s.duration || 0), 0);
    const newEndMinutes = timeToMinutes(booking.timeSlot) + originalDuration + addedDuration;

    const nextBookingQuery = {
      store: booking.store._id,
      date: booking.date,
      status: { $in: ["confirmed", "in_progress"] },
      _id: { $ne: booking._id },
    };
    if (booking.staffId) nextBookingQuery.staffId = booking.staffId;
    const sameDayBookings = await Booking.find(nextBookingQuery).select("timeSlot customer").lean();
    const nextBooking = sameDayBookings
      .filter(b => timeToMinutes(b.timeSlot) > timeToMinutes(booking.timeSlot))
      .sort((a, b) => timeToMinutes(a.timeSlot) - timeToMinutes(b.timeSlot))[0];

    if (nextBooking && timeToMinutes(nextBooking.timeSlot) < newEndMinutes) {
      slotWarning = `Heads up — with this added service, you may run into the next booking at ${nextBooking.timeSlot}. We've already sent them a heads-up about a possible short delay.`;

      // Proactively let the affected customer know, rather than leaving
      // them to find out only by showing up and waiting. They keep
      // their original slot either way — this is advance notice, not
      // a reschedule — but a heads-up beats a surprise wait with no
      // explanation.
      const estimatedDelay = newEndMinutes - timeToMinutes(nextBooking.timeSlot);
      if (nextBooking.customer) {
        sendNotification(
          nextBooking.customer,
          "Possible delay ⏱️",
          `The customer ahead of you at ${booking.store.name} added an extra service — your ${nextBooking.timeSlot} appointment may run about ${estimatedDelay} min behind. No action needed, just a heads up.`
        ).catch(()=>{});
      }
    }

    emitToRoom(`store:${booking.store._id}:${booking.date}`, "queue:update", { reason:"service_added", bookingId: booking._id });

    res.status(200).json({ success:true, message:"Service added", booking, slotWarning });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/bookings/:id/mark-addon-paid
// Marks the added-services portion as paid — entirely separate from
// the original booking's own paymentStatus, since this is always
// collected at the store (cash/UPI-at-counter), never prepaid online.
exports.markAddOnPaid = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("store", "owner");
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });
    if (booking.store?.owner?.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success:false, message:"Not authorized" });
    }
    if (!booking.addedServices.length) {
      return res.status(400).json({ success:false, message:"No added services on this booking" });
    }
    booking.addedServicesPaymentStatus = "paid";
    await booking.save();
    res.status(200).json({ success:true, message:"Add-on marked as paid", booking });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/bookings/:id/verify-otp — Owner verifies customer OTP to start service
exports.verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const booking = await Booking.findById(req.params.id).populate("store", "owner name");
    if (!booking)           return res.status(404).json({ success:false, message:"Booking not found" });
    if (booking.store?.owner?.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    if (booking.otpVerified) return res.status(400).json({ success:false, message:"OTP already verified" });
    if (booking.otp !== otp) return res.status(400).json({ success:false, message:"Invalid OTP. Ask customer to check their app." });
    booking.status      = "in_progress";
    booking.otpVerified = true;
    await booking.save();

    emitToRoom(`store:${booking.store._id}:${booking.date}`, "queue:update", { reason:"otp_verified", bookingId: booking._id });
    emitToRoom(`user:${booking.customer}`, "booking:status", { bookingId: booking._id, status:"in_progress", storeName: booking.store?.name });

    // Fire-and-forget — the service is already marked started above;
    // an owner shouldn't wait on a push notification round-trip before
    // seeing "Verify OTP" actually respond.
    sendNotification(booking.customer, "Your turn! 🎯", `Service started. Please proceed to the counter.`).catch(()=>{});
    res.status(200).json({ success:true, message:"OTP verified! Service started. ✅", booking });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/bookings/:id/cancel — Customer cancels their booking
// Combines a booking's date + time-slot string into an actual IST
// timestamp, so "hours until the slot" can be computed correctly
// regardless of whether the booking is today, tomorrow, or next week —
// a simple minutes-since-midnight comparison (fine for same-day
// reminders elsewhere in this codebase) wouldn't work here.
function getSlotDateTime(dateStr, timeSlot) {
  const [timePart, period] = timeSlot.split(" ");
  let [h, m] = timePart.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+05:30`);
}

// Set to 0 for now, meaning every cancellation gets a full refund
// regardless of timing — the time-based restriction (originally 2
// hours) is deliberately paused, not removed, so it's a one-line
// change to turn back on later. Everything below still runs the same
// comparison; it just always passes while this is 0.
const REFUND_NOTICE_HOURS = 0;

// PUT /api/bookings/:id/location  { lat, lng }
// Attaches the customer's location to an already-created booking, and
// recomputes estimatedTravelMinutes from it — used so the "time to
// head out" reminder still works, without making the customer wait for
// GPS before their booking itself is even confirmed. Called fire-and-
// forget by the frontend right after a successful booking; if this
// never arrives (denied permission, closed the tab too fast), the
// reminder job simply falls back to its default lead time, exactly as
// it already did when location capture failed at booking time before.
exports.updateBookingLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ success:false, message:"lat and lng are required" });
    }

    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id }).populate("store", "location");
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });

    // Only meaningful before the appointment happens — no point
    // updating travel-time estimates for a booking that's already
    // completed, cancelled, or in progress.
    if (booking.status !== "confirmed") {
      return res.status(200).json({ success:true, message:"Booking is no longer upcoming — location not needed" });
    }

    let estimatedTravelMinutes = booking.estimatedTravelMinutes || null;
    if (booking.store?.location?.lat && booking.store?.location?.lng) {
      const distanceKm = haversineKm(lat, lng, booking.store.location.lat, booking.store.location.lng);
      estimatedTravelMinutes = estimateTravelMinutes(distanceKm);
    }

    booking.customerLocation = { lat, lng };
    booking.estimatedTravelMinutes = estimatedTravelMinutes;
    await booking.save();

    res.status(200).json({ success:true, message:"Location updated" });
  } catch (err) {
    console.error("updateBookingLocation error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id }).populate("store", "name owner");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    // Matches what the frontend already only ever offers (the Cancel
    // button only appears for "confirmed" bookings) — enforced here too
    // rather than relying solely on the UI hiding the option, since the
    // API itself should never allow cancelling a visit that's already
    // underway, regardless of how the request was made.
    if (["completed","cancelled","in_progress"].includes(booking.status)) {
      return res.status(400).json({ success:false, message: booking.status === "in_progress" ? "Can't cancel — your service has already started." : `Cannot cancel a ${booking.status} booking` });
    }
    booking.status = "cancelled";
    booking.cancelReason = req.body.reason||"Cancelled by customer";

    // A service the owner already added (possible before the customer
    // even arrives, since add-ons can be added anytime pre-completion)
    // is now moot — nothing to refund, since add-ons are never prepaid,
    // but the owner should know they no longer need to prepare for it.
    if (booking.addedServices?.length > 0 && booking.store?.owner) {
      const addedNames = booking.addedServices.map(s => s.name).join(", ");
      sendNotification(booking.store.owner, "Booking Cancelled — had an add-on", `A booking with an added service (${addedNames}) was just cancelled by the customer.`).catch(()=>{});
    }

    // Refund policy — only applies to bookings actually paid via UPI.
    // Cash bookings and unpaid/abandoned UPI bookings have nothing to
    // refund, so this simply doesn't apply to them.
    let refundInfo = null;
    if (booking.paymentMode === "upi" && booking.paymentStatus === "paid") {
      const upiPaidAmount = Math.max(0, (booking.service?.price || 0) - (booking.walletDeducted || 0));
      const hoursUntilSlot = (getSlotDateTime(booking.date, booking.timeSlot).getTime() - Date.now()) / (1000 * 60 * 60);

      if (upiPaidAmount > 0) {
        if (hoursUntilSlot >= REFUND_NOTICE_HOURS) {
          const customer = await User.findById(booking.customer);
          customer.walletBalance = (customer.walletBalance || 0) + upiPaidAmount;
          await customer.save();
          // The owner's pending payout balance was credited this same
          // amount when the payment was originally verified — since
          // the customer is now getting it back, the owner shouldn't
          // still show it as money they're owed. Clamped at 0 so this
          // can never push the balance negative even in an edge case.
          await Store.updateOne(
            { _id: booking.store._id },
            [{ $set: { pendingUpiBalance: { $max: [0, { $subtract: ["$pendingUpiBalance", upiPaidAmount] }] } } }]
          );
          booking.refundStatus = "refunded_to_wallet";
          booking.refundAmount = upiPaidAmount;
          refundInfo = { refunded: true, amount: upiPaidAmount };
        } else {
          // Late cancellation — no refund, and the store's pending
          // balance is deliberately left untouched here: the owner
          // held that slot and lost the chance to fill it with
          // someone else, so they keep the payment as compensation,
          // matching common practice on real booking platforms.
          booking.refundStatus = "forfeited";
          booking.refundAmount = 0;
          refundInfo = { refunded: false, amount: 0, reason: `Cancelled within ${REFUND_NOTICE_HOURS} hours of the slot` };
        }
      }
    }

    await booking.save();

    // Pooled-capacity bookings (no named staff) reserved a "seat" via
    // SlotCapacity at creation time — free it back up now that this
    // booking no longer occupies the slot, so someone else can book it.
    // Named-staff bookings never created a SlotCapacity document, so
    // this simply matches nothing and safely no-ops for them.
    if (!booking.staffId) {
      await SlotCapacity.updateOne(
        { store: booking.store._id, date: booking.date, timeSlot: booking.timeSlot, bookedCount: { $gt: 0 } },
        { $inc: { bookedCount: -1 } }
      );
    }

    emitToRoom(`store:${booking.store._id}:${booking.date}`, "queue:update", { reason:"cancelled", bookingId: booking._id });
    Activity.create({
      store: booking.store._id,
      type: "booking_cancelled",
      title: "Booking Cancelled",
      message: `${booking.customerName || "A customer"} cancelled ${booking.service?.name || "their booking"} for ${booking.date} · ${booking.timeSlot}${booking.cancelReason ? ` — "${booking.cancelReason}"` : ""}`,
      booking: booking._id,
    }).catch(()=>{});

    // Fire-and-forget — the cancellation (and any refund) is already
    // fully committed above. The customer tapping "Confirm Cancellation"
    // shouldn't wait on an email round-trip before seeing it complete.
    (async () => {
      try {
        const customer = await User.findById(booking.customer);
        if (customer?.email) {
          const template = emailTemplates.bookingCancelled(customer.name, booking.store?.name||"Store", booking.date, booking.timeSlot);
          await sendEmail(customer.email, template.subject, template.html);
        }
      } catch (notifyErr) {
        console.error("Cancellation email error (cancellation still saved):", notifyErr.message);
      }
    })();

    res.status(200).json({ success:true, message:"Booking cancelled", booking, refund: refundInfo });
  } catch (err) {
    console.error("cancelBooking error:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/bookings/admin/stats
exports.getAdminStats = async (req, res) => {
  try {
    const today = getISTDateString();
    const [totalBookings, todayBookings, totalStores, totalUsers] = await Promise.all([
      Booking.countDocuments({}),
      Booking.countDocuments({ date:today }),
      Store.countDocuments({ isApproved:true }),
      User.countDocuments({ role:"customer" }),
    ]);
    const todayRevenue = await Booking.aggregate([
      { $match:{ date:today, status:"completed" } },
      { $group:{ _id:null, total:{ $sum:"$service.price" } } },
    ]);
    res.status(200).json({ success:true, stats:{ totalBookings, todayBookings, totalStores, totalUsers, todayRevenue: todayRevenue[0]?.total||0 } });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/bookings/store/blocked-dates — owner views every blocked
// date/slot entry for their own store, most recent first.
exports.getBlockedDates = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"You don't have a registered store" });
    const entries = [...(store.blockedSlots || [])].sort((a,b) => a.date < b.date ? 1 : -1);
    res.status(200).json({ success:true, blockedDates: entries });
  } catch (err) {
    console.error("getBlockedDates error:", err.message);
    res.status(500).json({ success:false, message:"Server error", error: process.env.NODE_ENV==="development"?err.message:undefined });
  }
};

// POST /api/bookings/store/blocked-dates  { date, slots, reason }
// — owner adds or replaces a blocked-date entry. Omitting `slots` (or
// sending an empty array) blocks the WHOLE day — the right choice for
// a festival/personal day off. Providing specific slots blocks only
// those — the right choice for "stepping out 2-4pm today."
exports.addBlockedDate = async (req, res) => {
  try {
    const { date, slots, reason } = req.body;
    if (!date) return res.status(400).json({ success:false, message:"Date is required" });

    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"You don't have a registered store" });

    // Replace any existing entry for this exact date rather than
    // stacking duplicates — an owner re-editing the same date should
    // overwrite, not add a second conflicting entry.
    store.blockedSlots = (store.blockedSlots || []).filter(b => b.date !== date);
    store.blockedSlots.push({
      date,
      slots: Array.isArray(slots) ? slots : [],
      reason: reason?.trim() || "Unavailable",
    });
    await store.save();

    res.status(201).json({ success:true, message:"Blocked date saved", blockedDates: store.blockedSlots });
  } catch (err) {
    console.error("addBlockedDate error:", err.message);
    res.status(500).json({ success:false, message:"Server error", error: process.env.NODE_ENV==="development"?err.message:undefined });
  }
};

// DELETE /api/bookings/store/blocked-dates/:date — owner removes a
// blocked-date entry entirely (re-opens that date for booking).
exports.removeBlockedDate = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) return res.status(404).json({ success:false, message:"You don't have a registered store" });

    const before = (store.blockedSlots || []).length;
    store.blockedSlots = (store.blockedSlots || []).filter(b => b.date !== req.params.date);
    if (store.blockedSlots.length === before) {
      return res.status(404).json({ success:false, message:"No blocked entry found for that date" });
    }
    await store.save();

    res.status(200).json({ success:true, message:"Date re-opened for booking", blockedDates: store.blockedSlots });
  } catch (err) {
    console.error("removeBlockedDate error:", err.message);
    res.status(500).json({ success:false, message:"Server error", error: process.env.NODE_ENV==="development"?err.message:undefined });
  }
};

// PUT /api/bookings/:id/reschedule  { date, timeSlot }
// Moves an existing booking to a different date/time. Mirrors the exact
// same atomic capacity pattern as createBooking — reserving the NEW
// slot and releasing the OLD one both happen inside one transaction,
// so a failure partway through can never leave a slot double-booked or
// a seat permanently "stuck" reserved with nothing occupying it.
exports.rescheduleBooking = async (req, res) => {
  try {
    const { date: newDate, timeSlot: newTimeSlot } = req.body;
    if (!newDate || !newTimeSlot) return res.status(400).json({ success:false, message:"New date and time slot are required" });

    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id }).populate("store", "name owner slotCapacity");
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });
    if (booking.status !== "confirmed") return res.status(400).json({ success:false, message:`Cannot reschedule a ${booking.status} booking` });
    if (booking.date === newDate && booking.timeSlot === newTimeSlot) {
      return res.status(400).json({ success:false, message:"That's already your current slot" });
    }

    const oldDate = booking.date, oldTimeSlot = booking.timeSlot;
    const store = booking.store;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      if (booking.staffId) {
        // Named-staff: the person can only serve one customer at a
        // time — check no one else already holds this new slot with them.
        const conflict = await Booking.findOne({
          store: store._id, date: newDate, timeSlot: newTimeSlot, staffId: booking.staffId,
          status: { $in:["confirmed","in_progress"] }, _id: { $ne: booking._id },
        }).session(session);
        if (conflict) throw new Error("SLOT_TAKEN");
      } else {
        // Pooled capacity: atomically reserve a seat in the NEW slot
        // first (same upsert pattern as creation — fails cleanly via
        // the unique index if the new slot is already full), then
        // release the seat held in the OLD slot.
        await SlotCapacity.findOneAndUpdate(
          { store: store._id, date: newDate, timeSlot: newTimeSlot, bookedCount: { $lt: store.slotCapacity || 1 } },
          { $inc: { bookedCount: 1 }, $setOnInsert: { store: store._id, date: newDate, timeSlot: newTimeSlot } },
          { upsert: true, session }
        );
        await SlotCapacity.updateOne(
          { store: store._id, date: oldDate, timeSlot: oldTimeSlot, bookedCount: { $gt: 0 } },
          { $inc: { bookedCount: -1 } },
          { session }
        );
      }

      booking.date = newDate;
      booking.timeSlot = newTimeSlot;
      await booking.save({ session });

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction().catch(()=>{});
      throw txErr;
    } finally {
      session.endSession();
    }

    // Real-time: update both the old day's queue (this booking leaves
    // it) and the new day's queue (it now appears there) — the owner's
    // dashboard reflects this instantly, on whichever day they're viewing.
    emitToRoom(`store:${store._id}:${oldDate}`, "queue:update", { reason:"rescheduled_out", bookingId: booking._id });
    emitToRoom(`store:${store._id}:${newDate}`, "queue:update", { reason:"rescheduled_in", bookingId: booking._id });

    sendNotification(store.owner, "Booking Rescheduled 🔄", `${req.user.name} moved their booking from ${oldDate} ${oldTimeSlot} to ${newDate} ${newTimeSlot}`).catch(()=>{});

    const populated = await Booking.findById(booking._id).populate("store", "name address phone city category location");
    res.status(200).json({ success:true, message:"Booking rescheduled successfully", booking: populated });
  } catch (err) {
    if (err.message === "SLOT_TAKEN" || (err.code === 11000 && err.message.includes("one_counter_per_slot"))) {
      return res.status(400).json({ success:false, message:"That slot is no longer available. Please choose another." });
    }
    console.error("RESCHEDULE ERROR:", err.message);
    res.status(500).json({ success:false, message:"Server error" });
  }
};