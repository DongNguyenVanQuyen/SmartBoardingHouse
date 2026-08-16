//src/routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  getInvoices,
  getInvoiceById,
  selectInvoiceRoom,
} = require("../controllers/invoiceController");

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Hóa đơn
 */

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: Danh sách hóa đơn
 *     tags: [Invoices]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [unpaid, partial, paid, overdue, cancelled]
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: contract
 *         schema:
 *           type: string
 *         description: Lọc hóa đơn theo ID hợp đồng (để tách riêng theo từng hợp đồng)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [rent, deposit]
 *         description: Lọc theo loại hóa đơn (tiền phòng hàng tháng / tiền cọc)
 *     responses:
 *       200:
 *         description: Danh sách hóa đơn
 */
router.get("/", protect, getInvoices);

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Chi tiết hóa đơn
 *     tags: [Invoices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin hóa đơn
 */
router.get("/:id", protect, getInvoiceById);

/**
 * @swagger
 * /invoices/select-room:
 *   patch:
 *     summary: Chuyển phòng đang chọn ngay tại màn hóa đơn (hợp đồng phải còn hiệu lực)
 *     tags: [Invoices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId]
 *             properties:
 *               contractId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Danh sách hóa đơn theo phòng vừa chuyển
 *       404:
 *         description: Hợp đồng không tồn tại hoặc không còn hiệu lực
 */
router.patch("/select-room", protect, selectInvoiceRoom);

module.exports = router;