//src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  getNotifications,
  markAsRead,
  updateFCMToken,
} = require("../controllers/notificationController");

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Thông báo
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Lấy danh sách thông báo
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Danh sách thông báo
 */
router.get("/", protect, getNotifications);

/**
 * @swagger
 * /notifications/read:
 *   put:
 *     summary: Đánh dấu thông báo đã đọc
 *     tags: [Notifications]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               all:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Đã đọc thông báo
 */
router.put("/read", protect, markAsRead);

/**
 * @swagger
 * /notifications/fcm-token:
 *   put:
 *     summary: Cập nhật FCM token
 *     tags: [Notifications]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật FCM token thành công
 */
router.put("/fcm-token", protect, updateFCMToken);

module.exports = router;