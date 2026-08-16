//src/routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  getDashboard,
  selectDashboardRoom,
} = require("../controllers/dashboardController");

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

/**
 * @swagger
 * /dashboard/select-room:
 *   patch:
 *     summary: Chuyển phòng đang chọn (dựa vào hợp đồng, hợp đồng phải còn hiệu lực)
 *     tags: [Dashboard]
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
 *         description: Dashboard theo phòng vừa chuyển
 *       404:
 *         description: Hợp đồng không tồn tại hoặc không còn hiệu lực
 */
router.patch("/select-room", protect, selectDashboardRoom);

module.exports = router;