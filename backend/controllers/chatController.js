// controllers/chatController.js
const Conversation = require("../models/Conversation");
const Store         = require("../models/Store");
const sendNotification = require("../config/notify");
const { emitToRoom } = require("../config/socket");

// ── Customer side ────────────────────────────────────────────────────────

// GET /api/chat/:storeId — fetch (or lazily create) the conversation with
// a store, and mark the customer's unread count as cleared.
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findById(storeId).select("name owner");
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    let convo = await Conversation.findOne({ customer: req.user.id, store: storeId });
    if (!convo) {
      convo = await Conversation.create({
        customer: req.user.id, store: storeId,
        customerName: req.user.name, storeName: store.name,
        messages: [],
      });
    } else if (convo.customerUnread > 0) {
      convo.customerUnread = 0;
      await convo.save();
    }
    res.status(200).json({ success:true, conversation: convo });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/chat/:storeId  { text }  — customer sends a message
exports.sendCustomerMessage = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success:false, message:"Message can't be empty" });

    const store = await Store.findById(storeId).select("name owner");
    if (!store) return res.status(404).json({ success:false, message:"Store not found" });

    let convo = await Conversation.findOne({ customer: req.user.id, store: storeId });
    if (!convo) {
      convo = await Conversation.create({
        customer: req.user.id, store: storeId,
        customerName: req.user.name, storeName: store.name,
        messages: [],
      });
    }

    convo.messages.push({ senderRole: "customer", text: text.trim() });
    convo.lastMessageAt = new Date();
    convo.lastMessageText = text.trim();
    convo.ownerUnread += 1;
    await convo.save();

    emitToRoom(`user:${store.owner}`, "chat:message", { conversationId: convo._id, storeId, fromRole: "customer" });
    sendNotification(store.owner, "New message 💬", `${req.user.name}: ${text.trim().slice(0,80)}`, "/icon-192.png", "chat").catch(()=>{});

    res.status(201).json({ success:true, conversation: convo });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// ── Owner side ───────────────────────────────────────────────────────────

// GET /api/chat/owner/conversations — every conversation across the
// owner's store(s), most recent first.
exports.getOwnerConversations = async (req, res) => {
  try {
    const myStores = await Store.find({ owner: req.user.id }).select("_id");
    const storeIds = myStores.map(s => s._id);
    const conversations = await Conversation.find({ store: { $in: storeIds } })
      .sort({ lastMessageAt: -1 })
      .select("-messages"); // list view doesn't need full message history
    res.status(200).json({ success:true, conversations });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// GET /api/chat/owner/conversations/:conversationId — full thread, marks
// the owner's unread count as cleared.
exports.getOwnerConversation = async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.conversationId).populate("store", "owner");
    if (!convo) return res.status(404).json({ success:false, message:"Conversation not found" });
    if (convo.store.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:"Not authorized" });

    if (convo.ownerUnread > 0) { convo.ownerUnread = 0; await convo.save(); }
    res.status(200).json({ success:true, conversation: convo });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};

// POST /api/chat/owner/conversations/:conversationId  { text } — owner replies
exports.sendOwnerMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success:false, message:"Message can't be empty" });

    const convo = await Conversation.findById(req.params.conversationId).populate("store", "owner name");
    if (!convo) return res.status(404).json({ success:false, message:"Conversation not found" });
    if (convo.store.owner.toString() !== req.user.id) return res.status(403).json({ success:false, message:"Not authorized" });

    convo.messages.push({ senderRole: "owner", text: text.trim() });
    convo.lastMessageAt = new Date();
    convo.lastMessageText = text.trim();
    convo.customerUnread += 1;
    await convo.save();

    console.log("📤 Emitting chat:message to room:", `user:${convo.customer}`);
    emitToRoom(`user:${convo.customer}`, "chat:message", { conversationId: convo._id, storeId: convo.store._id, fromRole: "owner" });
    sendNotification(convo.customer, `${convo.store.name} 💬`, text.trim().slice(0,80), "/icon-192.png", "chat").catch(()=>{});

    res.status(201).json({ success:true, conversation: convo });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};