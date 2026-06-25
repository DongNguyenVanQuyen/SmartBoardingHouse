//src/routes/debtRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { getDebts } = require("../controllers/debtController");

/**
 * @swagger
 * tags:
 *   name: Debts
 *   description: Công nợ
 */

/**
 * @swagger
 * /debts:
 *   get:
 *     summary: Xem tổng công nợ
 *     tags: [Debts]
 *     responses:
 *       200:
 *         description: Thông tin công nợ
 */
router.get("/", protect, getDebts);

module.exports = router;
