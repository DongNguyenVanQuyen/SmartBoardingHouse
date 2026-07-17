// src/routes/internalRoutes.js
const router = require("express").Router();
const internalAuth = require("../middlewares/internalAuth");
const {
  pushMessage,
  pushMessageRead,
  pushConversationRead,
} = require("../controllers/internalMessageController");

router.post("/messages/push", internalAuth, pushMessage);
router.post("/messages/push-read", internalAuth, pushMessageRead);
router.post("/messages/push-conversation-read", internalAuth, pushConversationRead);

module.exports = router;