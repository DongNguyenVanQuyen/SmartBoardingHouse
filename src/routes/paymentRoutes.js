// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/auth");
const {
  createPaymentSession,
  renderPaymentPage,
  confirmPaymentByToken,
  getPaymentStatus,
  getPaymentHistory,
} = require("../controllers/paymentController");

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Quản lý thanh toán hóa đơn bằng VietQR
 */

/**
 * @swagger
 * /payments/create-session:
 *   post:
 *     summary: Tạo phiên thanh toán
 *     description: Tạo phiên thanh toán và trả về thông tin VietQR để người dùng quét bằng ứng dụng ngân hàng.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *               - amount
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 example: 6874b6d2f2e9d2e4d5d12345
 *               amount:
 *                 type: number
 *                 example: 3500000
 *               method:
 *                 type: string
 *                 enum:
 *                   - qr
 *                   - cash
 *                   - transfer
 *                 default: qr
 *     responses:
 *       201:
 *         description: Tạo phiên thanh toán thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy hóa đơn
 */
router.post("/create-session", protect, createPaymentSession);

/**
 * @swagger
 * /payments/status/{token}:
 *   get:
 *     summary: Kiểm tra trạng thái thanh toán
 *     description: Android gọi định kỳ (polling) để kiểm tra người dùng đã xác nhận thanh toán hay chưa.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: payToken nhận được từ API create-session
 *     responses:
 *       200:
 *         description: Trạng thái phiên thanh toán
 *       404:
 *         description: Không tìm thấy phiên thanh toán
 */
router.get("/status/:token", protect, getPaymentStatus);

/**
 * @swagger
 * /payments/history:
 *   get:
 *     summary: Lấy lịch sử thanh toán
 *     description: Trả về danh sách các giao dịch thanh toán của người thuê.
 *     tags: [Payments]
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
 *           default: 10
 *     responses:
 *       200:
 *         description: Lấy lịch sử thanh toán thành công
 */
router.get("/history", protect, getPaymentHistory);

/**
 * @swagger
 * /payments/pay/{token}:
 *   get:
 *     summary: Hiển thị trang xác nhận thanh toán
 *     description: Trang HTML công khai dùng khi người dùng mở liên kết xác nhận thanh toán từ trình duyệt.
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: payToken của phiên thanh toán
 *     responses:
 *       200:
 *         description: Hiển thị trang xác nhận
 *       404:
 *         description: Không tìm thấy phiên thanh toán
 */
router.get("/pay/:token", renderPaymentPage);

/**
 * @swagger
 * /payments/pay/{token}/confirm:
 *   post:
 *     summary: Xác nhận thanh toán
 *     description: Đánh dấu phiên thanh toán thành công và cập nhật hóa đơn. API này không yêu cầu JWT.
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: payToken của phiên thanh toán
 *     responses:
 *       200:
 *         description: Thanh toán thành công
 *       400:
 *         description: Phiên thanh toán đã được xác nhận
 *       404:
 *         description: Không tìm thấy phiên thanh toán hoặc hóa đơn
 */
router.post("/pay/:token/confirm", confirmPaymentByToken);

module.exports = router;
