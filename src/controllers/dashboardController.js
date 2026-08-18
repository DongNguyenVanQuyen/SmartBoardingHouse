const Invoice = require("../models/Invoice");
const Contract = require("../models/Contract");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Notification = require("../models/Notification");
const { generateInvoice } = require("../services/invoiceService");
const { ensureDepositInvoice } = require("../services/depositInvoiceService");

// Dùng chung service quản lý chọn phòng với màn Công tơ & Hóa đơn
const { resolveSelectedContract, selectRoom } = require("../services/roomSelectionService");
const { success, error: sendError } = require("../utils/response");

const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 1. LẤY HỢP ĐỒNG CHUẨN XÁC MÀ USER ĐANG CHỌN (Đồng bộ 100% với Invoice/Công tơ)
    const { contract: resolvedContract, rooms: selectableRooms } = await resolveSelectedContract(req.user._id);

    // Nếu không có hợp đồng nào đang active
    if (!resolvedContract) {
      return success(res, {
        tenant: { id: req.user._id, fullName: req.user.fullName, email: req.user.email, phone: req.user.phone, avatar: req.user.avatar },
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

    // Lấy lại contract để populate đầy đủ cấu trúc tầng (floor) cho App khỏi lỗi
    const selectedContract = await Contract.findById(resolvedContract._id).populate({
      path: "room",
      populate: { path: "floor", select: "name floorNumber" },
    });

    // Tạo mảng danh sách phòng cho menu thả xuống "Chuyển phòng"
    const roomsOption = selectableRooms.map((r) => ({
      roomId: r.roomId,
      roomNumber: r.roomNumber,
      contractId: r.contractId,
      contractNumber: r.contractNumber || "",
      monthlyRent: r.price || 0,
      isSelected: r.contractId.toString() === selectedContract._id.toString()
    }));

    // 2. Tự động sinh hóa đơn cho TẤT CẢ các phòng đang thuê có hợp đồng còn hiệu lực (active)
    const activeContracts = await Contract.find({ tenant: req.user._id, status: "active" });
    for (const c of activeContracts) {
      if (c.room) {
        try {
          // Bảo đảm tạo hóa đơn tiền cọc cho hợp đồng này (Chỉ tạo 1 lần duy nhất)
          await ensureDepositInvoice(c);

          // Tạo hóa đơn tiền phòng/điện/nước hàng tháng
          await generateInvoice(req.user._id, c.room, c._id, currentMonth, currentYear);
        } catch (err) {
          console.error(`[INVOICE GENERATION ERROR for room ${c.roomNumber || c.room}]`, err);
        }
      }
    }

    // 3. Query dữ liệu hiển thị ra Dashboard
    const [
      currentInvoice,
      unpaidCount,
      totalDebtAgg,
      unreadNotifications,
      activeRequests,
    ] = await Promise.all([
      Invoice.findOne({
        tenant: req.user._id,
        contract: selectedContract._id, // Lọc chuẩn theo đúng phòng
        type: "rent",
        month: currentMonth,
        year: currentYear,
      }).populate({
        path: "room",
        populate: { path: "floor", select: "name floorNumber" },
      }).populate({
        path: "contract",
        populate: { 
          path: "room",
          populate: { path: "floor" } 
        } 
      }),

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

    let electricAmount = 0;
    let waterAmount = 0;

    if (currentInvoice) {
      if (currentInvoice.electricUsage > 0 || currentInvoice.electricPrice > 0) {
        electricAmount = currentInvoice.electricUsage * currentInvoice.electricPrice;
      }
      if (currentInvoice.waterUsage > 0 || currentInvoice.waterPrice > 0) {
        waterAmount = currentInvoice.waterUsage * currentInvoice.waterPrice;
      }
      // Backup cho dữ liệu quá cũ
      if (electricAmount === 0 && waterAmount === 0 && currentInvoice.items?.length) {
        currentInvoice.items.forEach((item) => {
          const name = item.name.toLowerCase();
          if (name.includes("điện") || name.includes("dien")) electricAmount += item.total;
          if (name.includes("nước") || name.includes("nuoc")) waterAmount += item.total;
        });
      }
    }

    return success(res, {
      tenant: { id: req.user._id, fullName: req.user.fullName, email: req.user.email, phone: req.user.phone, avatar: req.user.avatar },
      room: selectedContract.room,
      rooms: roomsOption,
      hasMultipleRooms: selectableRooms.length > 1,
      invoice: currentInvoice,
      stats: { 
        rentAmount: selectedContract.room?.price || 0, 
        electricAmount, 
        waterAmount, 
        unpaidCount, 
        totalDebt: totalDebtAgg[0]?.totalDebt || 0 
      },
      unreadNotifications,
      activeMaintenanceRequests: activeRequests,
      contract: { startDate: selectedContract.startDate, endDate: selectedContract.endDate },
    }, "Lấy dashboard thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// Hàm xử lý khi user bấm nút "Chọn phòng" trên màn hình Dashboard
const selectDashboardRoom = async (req, res) => {
  try {
    const { contractId } = req.body;
    if (!contractId) return sendError(res, "Thiếu ID hợp đồng");

    // LƯU LẠI LỰA CHỌN PHÒNG (Để màn Công Tơ và Hóa Đơn cũng ăn theo)
    await selectRoom(req.user._id, contractId);

    // Tái sử dụng lại logic getDashboard để trả về màn hình mới nhất
    return getDashboard(req, res);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    return sendError(res, err.message);
  }
};

module.exports = { getDashboard, selectDashboardRoom };