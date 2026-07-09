// src/routes/publicPaymentRoutes.js
const express = require("express");
const router = express.Router();
const {
  renderPaymentPage,
  confirmPaymentByToken,
} = require("../controllers/paymentController");

/**
 * @swagger
 * tags:
 *   name: PublicPayment
 *   description: Trang xác nhận thanh toán công khai (mở khi quét QR, không cần đăng nhập)
 */

/**
 * @swagger
 * /pay/{token}:
 *   get:
 *     summary: Trang HTML xác nhận thanh toán (mở khi quét QR)
 *     tags: [PublicPayment]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: payToken được encode trong QR
 *     responses:
 *       200:
 *         description: Trả về trang HTML hiển thị thông tin thanh toán và nút xác nhận
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Không tìm thấy phiên thanh toán
 */
router.get("/:token", renderPaymentPage);

/**
 * @swagger
 * /pay/{token}/confirm:
 *   post:
 *     summary: Xác nhận thanh toán (gọi từ trang HTML khi người dùng bấm nút)
 *     tags: [PublicPayment]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xác nhận thanh toán thành công, đã cập nhật hóa đơn
 *       400:
 *         description: Phiên thanh toán đã được xác nhận trước đó
 *       404:
 *         description: Không tìm thấy phiên thanh toán hoặc hóa đơn
 */
router.post("/:token/confirm", confirmPaymentByToken);

module.exports = router;
