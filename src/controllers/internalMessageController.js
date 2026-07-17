// src/controllers/internalMessageController.js
const { success, error: sendError } = require("../utils/response");
const conversationRoom = (tenantId) => `conversation_${tenantId}`;

// .NET đã insert message vào Mongo của nó rồi mới gọi sang đây —
// endpoint này KHÔNG ghi DB, chỉ phát realtime qua Socket.IO cho tenant app.
const pushMessage = async (req, res) => {
  try {
    const { message, tenantId } = req.body;
    if (!message || !tenantId) return sendError(res, "Thiếu message hoặc tenantId", 400);

    const io = req.app.get("io");
    if (io) io.to(conversationRoom(tenantId)).emit("new_message", message);

    return success(res, null, "Đã phát realtime");
  } catch (err) {
    return sendError(res, err.message);
  }
};

const pushMessageRead = async (req, res) => {
  try {
    const { conversationId, messageId } = req.body;
    const io = req.app.get("io");
    if (io) io.to(conversationRoom(conversationId)).emit("message_read", { messageId, conversationId });
    return success(res, null, "OK");
  } catch (err) {
    return sendError(res, err.message);
  }
};

const pushConversationRead = async (req, res) => {
  try {
    const { conversationId, readBy } = req.body;
    const io = req.app.get("io");
    if (io) io.to(conversationRoom(conversationId)).emit("messages_read", { conversationId, readBy });
    return success(res, null, "OK");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { pushMessage, pushMessageRead, pushConversationRead };