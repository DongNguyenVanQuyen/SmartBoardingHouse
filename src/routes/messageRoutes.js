// src/routes/messageRoutes.js
const express = require("express");
const router = express.Router();

const {
  getConversations,
  getMyMessages,
  getMessagesWithTenant,
  uploadChatImage,
} = require("../controllers/messageController");

// NOTE: đổi đường dẫn import này cho đúng với middleware xác thực JWT hiện có
// trong project của bạn (middleware phải gán req.user = { role, _id }).
const { protect } = require("../middlewares/auth");
const {
  uploadChatImage: uploadChatImageMiddleware,
} = require("../configs/cloudinary");

// ADMIN: danh sách hội thoại (mỗi tenant 1 hội thoại)
router.get("/", protect, getConversations);

// TENANT: lịch sử chat của chính mình
router.get("/me", protect, getMyMessages);

// ADMIN: lịch sử chat với 1 tenant cụ thể
router.get("/:tenantId", protect, getMessagesWithTenant);

// TENANT hoặc ADMIN: upload ảnh chat lên Cloudinary, trả về imageUrl
// Client sau đó gửi imageUrl này qua socket "send_message" (type: "image")
router.post(
  "/upload-image",
  protect,
  uploadChatImageMiddleware.single("image"),
  uploadChatImage,
);

module.exports = router;
