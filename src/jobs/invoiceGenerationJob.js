// src/jobs/invoiceGenerationJob.js
const cron = require("node-cron");
const {
  generateMonthlyInvoicesForAllRooms,
} = require("../services/invoiceService");

// Chạy lúc 0h00 hàng ngày (giờ Việt Nam)
const startInvoiceGenerationJob = () => {
  cron.schedule(
    "0 0 * * *",
    async () => {
      const now = new Date();
      try {
        await generateMonthlyInvoicesForAllRooms(
          now.getMonth() + 1,
          now.getFullYear(),
          now.getDate()
        );
      } catch (err) {
        console.error("[InvoiceGeneration] Lỗi khi chạy job:", err.message);
      }
    },
    { timezone: "Asia/Ho_Chi_Minh" },
  );

  console.log(
    "[InvoiceGeneration] Job đã được lên lịch (0h00 hàng ngày, GMT+7).",
  );
};

module.exports = { startInvoiceGenerationJob };
