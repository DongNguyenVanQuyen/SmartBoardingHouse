// src/controllers/dashboardController.js

const Invoice = require("../models/Invoice");
const Contract = require("../models/Contract");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Notification = require("../models/Notification");
const { success, error: sendError } = require("../utils/response");

const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    let currentMonth = now.getMonth() + 7;
    let currentYear = now.getFullYear() + 1;

    // Nếu tenant đang ở chế độ test (đã bấm nút qua tháng / đặt tháng thủ công
    // ở màn debug), dùng tháng test thay vì tháng thật.
    if (req.user.testMonth && req.user.testYear) {
      currentMonth = req.user.testMonth;
      currentYear = req.user.testYear;
    }

    // 1. Lấy contract
    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    }).populate({
      path: "room",
      populate: { path: "floor", select: "name floorNumber" },
    });

    // 2. Chỉ ĐỌC dữ liệu, không tự tạo/sửa hóa đơn ở đây nữa —
    // việc tạo hóa đơn hàng tháng do cron job (invoiceGenerationJob)
    // hoặc nút debug (admin.js) đảm nhiệm, không phải dashboard.
    const [
      currentInvoice,
      unpaidCount,
      totalDebtAgg,
      unreadNotifications,
      activeRequests,
    ] = await Promise.all([
      Invoice.findOne({
        tenant: req.user._id,
        month: currentMonth,
        year: currentYear,
      }).populate({
        path: "room",
        populate: { path: "floor", select: "name floorNumber" },
      }),

      Invoice.countDocuments({
        tenant: req.user._id,
        status: { $in: ["unpaid", "partial", "overdue"] },
      }),

      Invoice.aggregate([
        {
          $match: {
            tenant: req.user._id,
            status: { $in: ["unpaid", "partial", "overdue"] },
          },
        },
        {
          $group: {
            _id: null,
            totalDebt: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } },
          },
        },
      ]),

      Notification.countDocuments({ tenant: req.user._id, isRead: false }),

      MaintenanceRequest.countDocuments({
        tenant: req.user._id,
        status: { $in: ["pending", "processing"] },
      }),
    ]);

    const rentAmount = contract?.room?.price || 0;
    let electricAmount = 0;
    let waterAmount = 0;

    if (currentInvoice?.items?.length) {
      currentInvoice.items.forEach((item) => {
        const name = item.name.toLowerCase();
        if (name.includes("điện") || name.includes("dien"))
          electricAmount += item.total;
        if (name.includes("nước") || name.includes("nuoc"))
          waterAmount += item.total;
      });
    }

    return success(
      res,
      {
        tenant: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          phone: req.user.phone,
        },
        room: contract?.room || null,
        invoice: currentInvoice,
        stats: {
          rentAmount,
          electricAmount,
          waterAmount,
          unpaidCount,
          totalDebt: totalDebtAgg[0]?.totalDebt || 0,
        },
        unreadNotifications,
        activeMaintenanceRequests: activeRequests,
        contract: contract
          ? { startDate: contract.startDate, endDate: contract.endDate }
          : null,
      },
      "Lấy dashboard thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getDashboard };
