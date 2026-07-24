// routes/chat.js
const router = require("express").Router();
const {
  getOrCreateConversation, sendCustomerMessage,
  getOwnerConversations, getOwnerConversation, sendOwnerMessage,
} = require("../controllers/chatController");
const { protect } = require("../middleware/auth");

// Owner routes first — more specific paths must come before the
// generic "/:storeId" pattern, or Express would wrongly match
// "owner" as a storeId.
router.get ("/owner/conversations",                protect, getOwnerConversations);
router.get ("/owner/conversations/:conversationId", protect, getOwnerConversation);
router.post("/owner/conversations/:conversationId", protect, sendOwnerMessage);

router.get ("/:storeId", protect, getOrCreateConversation);
router.post("/:storeId", protect, sendCustomerMessage);

module.exports = router;