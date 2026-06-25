//src/routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { getDashboard } = require("../controllers/dashboardController");

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Tổng quan
 */

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Lấy dữ liệu dashboard
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Tổng hợp dữ liệu dashboard
 */
router.get("/", protect, getDashboard);

module.exports = router;
