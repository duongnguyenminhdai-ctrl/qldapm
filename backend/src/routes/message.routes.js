const express = require("express");
const {
  getConversations,
  createGroup,
  getOrCreateDirectConversation,
  getMessages,
  sendMessage,
  revokeMessage,
} = require("../controllers/message.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/conversations", getConversations);
router.post("/create-group", createGroup);
router.post("/direct", getOrCreateDirectConversation);
router.get("/:conversationId", getMessages);
router.post("/send", sendMessage);
router.patch("/:id/revoke", revokeMessage);
router.patch("/:id/recall", revokeMessage);

module.exports = router;
