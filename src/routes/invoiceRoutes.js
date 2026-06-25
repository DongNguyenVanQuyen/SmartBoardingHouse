//src/routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  getInvoices,
  getInvoiceById,
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
 *           enum: [unpaid, partial, paid, overdue]
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
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

module.exports = router;
