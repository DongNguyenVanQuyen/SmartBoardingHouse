// src/jobs/contractStatusJob.js
//
// Job chạy hàng ngày để:
//  1. Tự động chuyển hợp đồng "active" đã quá endDate -> "expired".
//  2. Đảm bảo mỗi hợp đồng có đúng 1 hóa đơn cọc (tạo nếu còn thiếu — hữu ích
//     cho cả hợp đồng cũ lẫn hợp đồng mới được tạo trực tiếp từ hệ thống Admin).
//  3. Với hợp đồng đã kết thúc (expired/terminated — kể cả bị Admin hủy trực
//     tiếp trong DB), xử lý hóa đơn cọc tương ứng: thông báo hoàn cọc (nếu đã
//     thanh toán) hoặc hủy hóa đơn cọc (nếu chưa thanh toán xong).
const cron = require("node-cron");
const Contract = require("../models/Contract");
const {
  ensureDepositInvoice,
  handleContractEnded,
} = require("../services/depositInvoiceService");

const runContractStatusCheck = async () => {
  const contracts = await Contract.find({});
  const now = new Date();

  let expiredCount = 0;
  let depositCreated = 0;
  let endedHandled = 0;
  const failed = [];

  for (const contract of contracts) {
    try {
      // 1. Tự động hết hạn nếu quá endDate mà vẫn đang active.
      if (
        contract.status === "active" &&
        contract.endDate &&
        contract.endDate < now
      ) {
        contract.status = "expired";
        await contract.save();
        expiredCount++;
      }

      // 2. Đảm bảo hợp đồng có hóa đơn cọc (tạo 1 lần duy nhất nếu thiếu).
      const created = await ensureDepositInvoice(contract);
      if (created) depositCreated++;

      // 3. Hợp đồng đã kết thúc -> xử lý hóa đơn cọc (hoàn cọc / hủy hóa đơn).
      if (["expired", "terminated"].includes(contract.status)) {
        await handleContractEnded(contract);
        endedHandled++;
      }
    } catch (err) {
      failed.push({ contractId: contract._id, error: err.message });
    }
  }

  console.log(
    `[ContractStatus] Quét ${contracts.length} hợp đồng: ${expiredCount} tự hết hạn, ${depositCreated} hóa đơn cọc mới, ${endedHandled} hợp đồng đã kết thúc được xử lý, ${failed.length} lỗi.`,
  );
  if (failed.length) console.error(failed);

  return { expiredCount, depositCreated, endedHandled, failed };
};

// Chạy lúc 0h30 hàng ngày (giờ Việt Nam) — sau debtReminderJob (8h sáng vẫn ổn
// vì đây là job riêng, không phụ thuộc thứ tự).
const startContractStatusJob = () => {
  cron.schedule(
    "30 0 * * *",
    async () => {
      try {
        await runContractStatusCheck();
      } catch (err) {
        console.error("[ContractStatus] Lỗi khi chạy job:", err.message);
      }
    },
    { timezone: "Asia/Ho_Chi_Minh" },
  );

  console.log(
    "[ContractStatus] Job đã được lên lịch (0h30 hàng ngày, GMT+7).",
  );
};

module.exports = { startContractStatusJob, runContractStatusCheck };