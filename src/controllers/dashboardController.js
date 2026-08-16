// src/controllers/dashboardController.js

const Invoice = require("../models/Invoice");
const Contract = require("../models/Contract");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Notification = require("../models/Notification");
const { generateInvoice } = require("../services/invoiceService");
const { success, error: sendError } = require("../utils/response");

const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 1. Lấy contract trước
    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    }).populate({
      path: "room",
      populate: { path: "floor", select: "name floorNumber" },
    });

    // 2. ⭐ Đợi generateInvoice xong rồi mới query, để đảm bảo có dữ liệu mới nhất
    if (contract?.room?._id) {
      try {
        await generateInvoice(
          req.user._id,
          contract.room._id,
          contract._id,
          currentMonth,
          currentYear,
        );
      } catch (err) {
        console.error("[INVOICE ERROR]", err);
        // không throw để dashboard vẫn load được, chỉ log lỗi
      }
    }

    // 3. Giờ mới query — invoice chắc chắn đã tồn tại (nếu có contract)
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

    if (currentInvoice) {
      // ⭐ FIX: Ưu tiên tính trực tiếp từ các field riêng của invoice
      // (roomPrice/electricUsage/electricPrice/waterUsage/waterPrice),
      // vì hóa đơn tự sinh hàng tháng (generateInvoice) thường KHÔNG điền
      // vào items[] — items[] chỉ dùng cho hóa đơn nhập tay/khác.
      // Trước đây code chỉ đọc items[] nên với hóa đơn tự sinh, electricAmount/
      // waterAmount luôn = 0 dù invoice đã có dữ liệu, khiến app hiển thị nhầm
      // "Chưa chụp" trong khi hóa đơn đã có số liệu điện/nước.
      if (currentInvoice.electricUsage > 0 || currentInvoice.electricPrice > 0) {
        electricAmount = currentInvoice.electricUsage * currentInvoice.electricPrice;
      }
      if (currentInvoice.waterUsage > 0 || currentInvoice.waterPrice > 0) {
        waterAmount = currentInvoice.waterUsage * currentInvoice.waterPrice;
      }

      // Fallback: nếu invoice không có các field riêng (electricAmount/waterAmount
      // vẫn = 0) nhưng có items[], thử tính từ items[] như cũ.
      if (electricAmount === 0 && waterAmount === 0 && currentInvoice.items?.length) {
        currentInvoice.items.forEach((item) => {
          const name = item.name.toLowerCase();
          if (name.includes("điện") || name.includes("dien"))
            electricAmount += item.total;
          if (name.includes("nước") || name.includes("nuoc"))
            waterAmount += item.total;
        });
      }
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