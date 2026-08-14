const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { clearMonthData } = require("../controllers/debugController");

/**
 * @swagger
 * tags:
 *   name: Debug
 *   description: Công cụ debug/test dữ liệu tháng
 */

/**
 * @swagger
 * /debug/clear-month:
 *   post:
 *     summary: Xóa dữ liệu hóa đơn, thanh toán và công tơ của tenant trong tháng hiện tại
 *     tags: [Debug]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               month:
 *                 type: integer
 *                 example: 8
 *               year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: Xóa dữ liệu thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 */
router.post("/clear-month", protect, clearMonthData);

module.exports = router;