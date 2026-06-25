//src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  createPayment,
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
 * /payments:
 *   post:
 *     summary: Tạo thanh toán
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
 *         description: Thanh toán thành công
 */
router.post("/", protect, createPayment);

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
