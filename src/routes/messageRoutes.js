// src/routes/messageRoutes.js
const express = require("express");
const router = express.Router();

const {
  getConversations,
  getMyMessages,
  getMessagesWithTenant,
  sendMessage,
  uploadChatImage,
} = require("../controllers/messageController");

const { protect } = require("../middlewares/auth");
const {
  uploadChatImage: uploadChatImageMiddleware,
} = require("../configs/cloudinary");

// ADMIN: danh sách hội thoại (mỗi tenant 1 hội thoại)
router.get("/", protect, getConversations);

// TENANT: lịch sử chat của chính mình
router.get("/me", protect, getMyMessages);

// TENANT hoặc ADMIN: gửi tin nhắn qua REST (dùng cho web Admin — không có socket.io-client)
// Tenant/app Android vẫn có thể tiếp tục dùng socket "send_message" như cũ, không bắt buộc đổi.
router.post("/send", protect, sendMessage);

// ADMIN: lịch sử chat với 1 tenant cụ thể
router.get("/:tenantId", protect, getMessagesWithTenant);

// TENANT hoặc ADMIN: upload ảnh chat lên Cloudinary
router.post(
  "/upload-image",
  protect,
  uploadChatImageMiddleware.single("image"),
  uploadChatImage,
);

module.exports = router;