//src/routes/debtRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { getDebts } = require("../controllers/debtController");
const { runDebtReminders } = require("../services/debtReminderService");
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
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin công nợ
 */
router.get("/", protect, getDebts);

/**
 * @swagger
 * /debts/debug/run-reminder:
 *   get:
 *     summary: Chạy debt reminder ngay lập tức
 *     tags: [Debts]
 *     responses:
 *       200:
 *         description: Đã chạy reminder thành công
 */
router.get("/debug/run-reminder", async (req, res) => {
  await runDebtReminders();
  res.json({
    ok: true,
    message: "Đã chạy xong, kiểm tra collection Notification",
  });
});
module.exports = router;
