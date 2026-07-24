// routes/support.js
const router = require("express").Router();
const { createTicket, getMyTickets, getAllTickets, updateTicketStatus } = require("../controllers/supportController");
const { protect, authorize } = require("../middleware/auth");

router.post("/",               protect, createTicket);
router.get ("/my",              protect, getMyTickets);
router.get ("/admin/all",       protect, authorize("admin"), getAllTickets);
router.put ("/:id/status",      protect, authorize("admin"), updateTicketStatus);

module.exports = router;