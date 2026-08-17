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

    // 1. Lấy TẤT CẢ hợp đồng active của user thay vì chỉ lấy 1
    const contracts = await Contract.find({
      tenant: req.user._id,
      status: "active",
    })
      .populate({
        path: "room",
        populate: { path: "floor", select: "name floorNumber" },
      })
      .sort({ createdAt: -1 }); // Ưu tiên hợp đồng mới nhất lên đầu

    // Rủi ro bắt lỗi 1: Không có hợp đồng nào
    if (!contracts || contracts.length === 0) {
      return success(res, {
        tenant: { id: req.user._id, fullName: req.user.fullName, email: req.user.email, phone: req.user.phone },
        room: null,
        rooms: [],
        hasMultipleRooms: false,
        invoice: null,
        stats: { rentAmount: 0, electricAmount: 0, waterAmount: 0, unpaidCount: 0, totalDebt: 0 },
        unreadNotifications: await Notification.countDocuments({ tenant: req.user._id, isRead: false }),
        activeMaintenanceRequests: 0,
        contract: null
      }, "Chưa có phòng thuê");
    }

    // Xác định hợp đồng đang được xem (Mặc định là cái đầu tiên nếu FE không gửi ID phòng)
    // Tương lai: Bạn có thể lưu req.user.selectedContractId vào DB để nhớ phòng user đang xem
    const selectedContract = contracts[0]; 

    // Tạo mảng rooms cho Android vẽ UI chọn phòng
    const roomsOption = contracts.map((c, index) => ({
      roomId: c.room?._id,
      roomNumber: c.room?.name || c.room?.roomNumber,
      contractId: c._id,
      contractNumber: c.contractNumber || "",
      monthlyRent: c.room?.price || 0,
      isSelected: index === 0 // Đánh dấu phòng đầu tiên là đang chọn
    }));

    // 2. Generate Invoice cho phòng đang chọn
    if (selectedContract?.room?._id) {
      try {
        await generateInvoice(req.user._id, selectedContract.room._id, selectedContract._id, currentMonth, currentYear);
      } catch (err) {
        console.error("[INVOICE ERROR]", err);
      }
    }

    // 3. Query dữ liệu
    const [
      currentInvoice,
      unpaidCount,
      totalDebtAgg,
      unreadNotifications,
      activeRequests,
    ] = await Promise.all([
      Invoice.findOne({
        tenant: req.user._id,
        room: selectedContract.room._id, // Chỉ lấy hóa đơn của phòng ĐANG CHỌN
        month: currentMonth,
        year: currentYear,
      }).populate({
        path: "room",
        populate: { path: "floor", select: "name floorNumber" },
      })
      .populate({
        path: "contract",
        populate: { 
          path: "room",
          populate: { path: "floor" } // Bọc luôn floor cho Android đỡ báo lỗi
        } 
      }),

      // Đếm nợ của TẤT CẢ các phòng (để user biết mình đang nợ tổng bao nhiêu)
      Invoice.countDocuments({
        tenant: req.user._id,
        status: { $in: ["unpaid", "partial", "overdue"] },
      }),

      Invoice.aggregate([
        { $match: { tenant: req.user._id, status: { $in: ["unpaid", "partial", "overdue"] } } },
        { $group: { _id: null, totalDebt: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } } } },
      ]),

      Notification.countDocuments({ tenant: req.user._id, isRead: false }),

      MaintenanceRequest.countDocuments({ tenant: req.user._id, status: { $in: ["pending", "processing"] } }),
    ]);

    const rentAmount = selectedContract?.room?.price || 0;
    let electricAmount = 0;
    let waterAmount = 0;

    if (currentInvoice) {
      if (currentInvoice.electricUsage > 0 || currentInvoice.electricPrice > 0) {
        electricAmount = currentInvoice.electricUsage * currentInvoice.electricPrice;
      }
      if (currentInvoice.waterUsage > 0 || currentInvoice.waterPrice > 0) {
        waterAmount = currentInvoice.waterUsage * currentInvoice.waterPrice;
      }
      if (electricAmount === 0 && waterAmount === 0 && currentInvoice.items?.length) {
        currentInvoice.items.forEach((item) => {
          const name = item.name.toLowerCase();
          if (name.includes("điện") || name.includes("dien")) electricAmount += item.total;
          if (name.includes("nước") || name.includes("nuoc")) waterAmount += item.total;
        });
      }
    }

    return success(res, {
      tenant: { id: req.user._id, fullName: req.user.fullName, email: req.user.email, phone: req.user.phone },
      room: selectedContract.room,
      rooms: roomsOption, // TRẢ VỀ CHO ANDROID
      hasMultipleRooms: contracts.length > 1, // TRẢ VỀ CHO ANDROID
      invoice: currentInvoice,
      stats: { rentAmount, electricAmount, waterAmount, unpaidCount, totalDebt: totalDebtAgg[0]?.totalDebt || 0 },
      unreadNotifications,
      activeMaintenanceRequests: activeRequests,
      contract: { startDate: selectedContract.startDate, endDate: selectedContract.endDate },
    }, "Lấy dashboard thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};
// Hàm xử lý khi user bấm "Chọn phòng" trên App
const selectDashboardRoom = async (req, res) => {
  try {
    const { contractId } = req.body;
    if (!contractId) return sendError(res, "Thiếu ID hợp đồng");

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const contracts = await Contract.find({
      tenant: req.user._id,
      status: "active",
    })
      .populate({
        path: "room",
        populate: { path: "floor", select: "name floorNumber" },
      })
      .sort({ createdAt: -1 });

    if (!contracts || contracts.length === 0) {
      return sendError(res, "Không tìm thấy hợp đồng nào");
    }

    // Tìm hợp đồng mà user vừa click chọn, nếu không thấy thì lấy cái đầu tiên
    const selectedContract = contracts.find(c => c._id.toString() === contractId) || contracts[0];

    // Cập nhật lại mảng roomsOption, set isSelected = true cho phòng vừa chọn
    const roomsOption = contracts.map((c) => ({
      roomId: c.room?._id,
      roomNumber: c.room?.name || c.room?.roomNumber,
      contractId: c._id,
      contractNumber: c.contractNumber || "",
      price: c.room?.price || 0, // Đã map đúng chữ price
      isSelected: c._id.toString() === selectedContract._id.toString()
    }));

    // Đảm bảo hóa đơn của phòng mới chọn đã được sinh ra
    if (selectedContract?.room?._id) {
      try {
        await generateInvoice(req.user._id, selectedContract.room._id, selectedContract._id, currentMonth, currentYear);
      } catch (err) {
        console.error("[INVOICE ERROR]", err);
      }
    }

    // Query lại toàn bộ dữ liệu nhưng focus vào phòng vừa chọn
    const [
      currentInvoice,
      unpaidCount,
      totalDebtAgg,
      unreadNotifications,
      activeRequests,
    ] = await Promise.all([
      Invoice.findOne({
        tenant: req.user._id,
        room: selectedContract.room._id, // Lấy hóa đơn của phòng mới chọn
        month: currentMonth,
        year: currentYear,
      }).populate({
        path: "room",
        populate: { path: "floor", select: "name floorNumber" },
      }).populate({
        path: "contract",
        populate: { 
          path: "room",
          populate: { path: "floor" } // Bọc luôn floor cho Android đỡ báo lỗi
        } 
      }), // Giữ nguyên Object contract để FE không lỗi

      Invoice.countDocuments({
        tenant: req.user._id,
        status: { $in: ["unpaid", "partial", "overdue"] },
      }),

      Invoice.aggregate([
        { $match: { tenant: req.user._id, status: { $in: ["unpaid", "partial", "overdue"] } } },
        { $group: { _id: null, totalDebt: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } } } },
      ]),

      Notification.countDocuments({ tenant: req.user._id, isRead: false }),

      MaintenanceRequest.countDocuments({
        tenant: req.user._id,
        status: { $in: ["pending", "processing"] },
      }),
    ]);

    const rentAmount = selectedContract?.room?.price || 0;
    let electricAmount = 0;
    let waterAmount = 0;

    if (currentInvoice) {
      if (currentInvoice.electricUsage > 0 || currentInvoice.electricPrice > 0) {
        electricAmount = currentInvoice.electricUsage * currentInvoice.electricPrice;
      }
      if (currentInvoice.waterUsage > 0 || currentInvoice.waterPrice > 0) {
        waterAmount = currentInvoice.waterUsage * currentInvoice.waterPrice;
      }
      if (electricAmount === 0 && waterAmount === 0 && currentInvoice.items?.length) {
        currentInvoice.items.forEach((item) => {
          const name = item.name.toLowerCase();
          if (name.includes("điện") || name.includes("dien")) electricAmount += item.total;
          if (name.includes("nước") || name.includes("nuoc")) waterAmount += item.total;
        });
      }
    }

    return success(res, {
      tenant: { id: req.user._id, fullName: req.user.fullName, email: req.user.email, phone: req.user.phone },
      room: selectedContract.room,
      rooms: roomsOption,
      hasMultipleRooms: contracts.length > 1,
      invoice: currentInvoice,
      stats: { rentAmount, electricAmount, waterAmount, unpaidCount, totalDebt: totalDebtAgg[0]?.totalDebt || 0 },
      unreadNotifications,
      activeMaintenanceRequests: activeRequests,
      contract: { startDate: selectedContract.startDate, endDate: selectedContract.endDate },
    }, "Chuyển phòng thành công");

  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getDashboard, selectDashboardRoom };