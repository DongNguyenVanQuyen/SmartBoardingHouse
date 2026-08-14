// src/routes/messageRoutes.js
const express = require("express");
const router = express.Router();

const {
  getConversations,
  getAllUsersForAdmin,
  getMyMessages,
  getMessagesWithTenant,
  sendMessage,
  uploadChatImage,
} = require("../controllers/messageController");

const { protect } = require("../middlewares/auth");
const {
  uploadChatImage: uploadChatImageMiddleware,
} = require("../configs/cloudinary");

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Chat / hội thoại giữa tenant và admin
 */

/**
 * @swagger
 * /messages:
 *   get:
 *     summary: Lấy danh sách hội thoại của admin
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/", protect, getConversations);

/**
 * @swagger
 * /messages/users:
 *   get:
 *     summary: Lấy danh sách tenant để chat
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/users", protect, getAllUsersForAdmin);

/**
 * @swagger
 * /messages/me:
 *   get:
 *     summary: Lấy lịch sử chat của tenant hiện tại
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/me", protect, getMyMessages);

/**
 * @swagger
 * /messages/send:
 *   post:
 *     summary: Gửi tin nhắn qua REST API
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: Xin chào admin
 *               type:
 *                 type: string
 *                 example: Text
 *               tenantId:
 *                 type: string
 *                 example: 64c0b0d5e3a7d9f1b2c3d4e5
 *               imageUrl:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Gửi tin nhắn thành công
 */
router.post("/send", protect, sendMessage);

/**
 * @swagger
 * /messages/{tenantId}:
 *   get:
 *     summary: Lấy lịch sử chat với tenant cụ thể
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/:tenantId", protect, getMessagesWithTenant);

/**
 * @swagger
 * /messages/upload-image:
 *   post:
 *     summary: Upload ảnh chat lên Cloudinary
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload ảnh thành công
 */
router.post(
  "/upload-image",
  protect,
  uploadChatImageMiddleware.single("image"),
  uploadChatImage,
);

module.exports = router;