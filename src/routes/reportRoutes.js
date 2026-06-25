//src/routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { getMonthlyReport } = require("../controllers/reportController");

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Báo cáo chi tiêu
 */

/**
 * @swagger
 * /reports/monthly:
 *   get:
 *     summary: Báo cáo tháng
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Báo cáo chi tiêu tháng
 */
router.get("/monthly", protect, getMonthlyReport);

module.exports = router;
