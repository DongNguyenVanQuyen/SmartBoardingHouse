// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  createPaymentSession,
  getPaymentStatus,
  getPaymentHistory,
} = require("../controllers/paymentController");

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Thanh toán QR
 */

/**
 * @swagger
 * /payments/create-session:
 *   post:
 *     summary: Tạo phiên thanh toán (trả về QR để quét xác nhận)
 *     tags: [Payments]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceId, amount]
 *             properties:
 *               invoiceId: { type: string }
 *               amount: { type: number }
 *               method:
 *                 type: string
 *                 enum: [qr, cash, transfer]
 *     responses:
 *       201:
 *         description: Tạo phiên thanh toán thành công, trả về qrUrl để tạo mã QR
 *       400:
 *         description: Thiếu thông tin hoặc số tiền vượt quá số còn lại
 *       404:
 *         description: Không tìm thấy hóa đơn
 */
router.post("/create-session", protect, createPaymentSession);

/**
 * @swagger
 * /payments/status/{token}:
 *   get:
 *     summary: Kiểm tra trạng thái phiên thanh toán (dùng để app poll)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: payToken nhận được từ create-session
 *     responses:
 *       200:
 *         description: Trạng thái phiên thanh toán (pending / success / failed)
 *       404:
 *         description: Không tìm thấy phiên thanh toán
 */
router.get("/status/:token", protect, getPaymentStatus);

/**
 * @swagger
 * /payments/history:
 *   get:
 *     summary: Lịch sử thanh toán
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lịch sử thanh toán
 */
router.get("/history", protect, getPaymentHistory);

module.exports = router;
