// controllers/supportController.js
const SupportTicket = require("../models/SupportTicket");


// POST /api/support — Customer or owner submits a support ticket
exports.createTicket = async (req, res) => {
  try {
    const { category, subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success:false, message:"Please fill in both the subject and details" });
    }
    const ticket = await SupportTicket.create({
      user:      req.user.id,
      userName:  req.user.name,
      userPhone: req.user.phone,
      userRole:  req.user.role === "owner" ? "owner" : "customer",
      category:  category || "other",
      subject:   subject.trim(),
      message:   message.trim(),
    });
    res.status(201).json({ success:true, message:"We've got your report — our team will look into it soon.", ticket });
  } catch (err) {
    console.error("CREATE TICKET ERROR — full stack:");
    console.error(err);
    if (err.name === "ValidationError") return res.status(400).json({ success:false, message: Object.values(err.errors)[0].message });
    res.status(500).json({ success:false, message:"Server error", error: process.env.NODE_ENV==="development" ? err.message : undefined });
  }
};

// GET /api/support/my — User's own submitted tickets
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user.id }).sort({ createdAt:-1 });
    res.status(200).json({ success:true, tickets });
  } catch (err) {
    console.error("GET MY TICKETS ERROR:", err);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/support/admin/all?status=open — Admin views all tickets
exports.getAllTickets = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    // .limit(200) is a safety cap, not real pagination — every ticket
    // ever filed, unbounded, would otherwise load in full on every
    // single visit to the admin support inbox, growing forever as
    // tickets accumulate over the app's lifetime.
    const tickets = await SupportTicket.find(filter).sort({ createdAt:-1 }).limit(200).lean();
    res.status(200).json({ success:true, count:tickets.length, tickets });
  } catch (err) {
    console.error("GET ALL TICKETS ERROR:", err);
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// PUT /api/support/:id/status — Admin updates ticket status
exports.updateTicketStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const updates = { status };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (status === "resolved") updates.resolvedAt = new Date();
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, updates, { new:true });
    if (!ticket) return res.status(404).json({ success:false, message:"Ticket not found" });
    res.status(200).json({ success:true, message:"Ticket updated", ticket });
  } catch (err) {
    console.error("UPDATE TICKET ERROR:", err);
    res.status(500).json({ success:false, message:"Server error" });
  }
};