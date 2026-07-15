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
