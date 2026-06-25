//src/routes/statisticsRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  getMonthlyStatistics,
  getYearlyStatistics,
} = require("../controllers/statisticsController");

/**
 * @swagger
 * tags:
 *   name: Statistics
 *   description: Thống kê chi tiêu
 */

/**
 * @swagger
 * /statistics/monthly:
 *   get:
 *     summary: Thống kê theo tháng
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Thống kê tháng
 */
router.get("/monthly", protect, getMonthlyStatistics);

/**
 * @swagger
 * /statistics/yearly:
 *   get:
 *     summary: Thống kê theo năm
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Thống kê năm
 */
router.get("/yearly", protect, getYearlyStatistics);

module.exports = router;
