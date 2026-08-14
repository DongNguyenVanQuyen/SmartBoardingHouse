// src/routes/internalRoutes.js
const router = require("express").Router();
const internalAuth = require("../middlewares/internalAuth");
const {
  pushMessage,
  pushMessageRead,
  pushConversationRead,
} = require("../controllers/internalMessageController");

/**
 * @swagger
 * tags:
 *   name: Internal
 *   description: API nội bộ giữa backend hệ thống
 */

/**
 * @swagger
 * /internal/messages/push:
 *   post:
 *     summary: Phát tin nhắn realtime tới tenant qua Socket.IO
 *     tags: [Internal]
 *     parameters:
 *       - in: header
 *         name: x-internal-key
 *         required: true
 *         schema:
 *           type: string
 *         description: Internal API key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, message]
 *             properties:
 *               tenantId:
 *                 type: string
 *                 example: 64c0b0d5e3a7d9f1b2c3d4e5
 *               message:
 *                 type: object
 *                 example: { text: "Xin chào" }
 *     responses:
 *       200:
 *         description: Phát realtime thành công
 *       403:
 *         description: Forbidden
 */
router.post("/messages/push", internalAuth, pushMessage);

/**
 * @swagger
 * /internal/messages/push-read:
 *   post:
 *     summary: Thông báo tin nhắn đã đọc
 *     tags: [Internal]
 *     parameters:
 *       - in: header
 *         name: x-internal-key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversationId, messageId]
 *             properties:
 *               conversationId:
 *                 type: string
 *               messageId:
 *                 type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.post("/messages/push-read", internalAuth, pushMessageRead);

/**
 * @swagger
 * /internal/messages/push-conversation-read:
 *   post:
 *     summary: Thông báo toàn bộ hội thoại đã đọc
 *     tags: [Internal]
 *     parameters:
 *       - in: header
 *         name: x-internal-key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversationId, readBy]
 *             properties:
 *               conversationId:
 *                 type: string
 *               readBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.post("/messages/push-conversation-read", internalAuth, pushConversationRead);

module.exports = router;