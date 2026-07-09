// src/jobs/debtReminderJob.js
const cron = require("node-cron");
const { runDebtReminders } = require("../services/debtReminderService");

// Chạy mỗi ngày lúc 8:00 sáng (giờ Việt Nam)
const startDebtReminderJob = () => {
  cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        await runDebtReminders();
      } catch (err) {
        console.error("[DebtReminder] Lỗi khi chạy job:", err.message);
      }
    },
    { timezone: "Asia/Ho_Chi_Minh" },
  );

  console.log("[DebtReminder] Job đã được lên lịch (8:00 hàng ngày, GMT+7).");
};

module.exports = { startDebtReminderJob };
