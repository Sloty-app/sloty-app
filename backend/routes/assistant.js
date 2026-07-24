// routes/assistant.js
const router = require("express").Router();
const { chat } = require("../controllers/assistantController");
const { protect } = require("../middleware/auth");

router.post("/chat", protect, chat);

module.exports = router;