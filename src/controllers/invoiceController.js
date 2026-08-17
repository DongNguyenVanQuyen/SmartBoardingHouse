const Invoice = require("../models/Invoice");
const Contract = require("../models/Contract");
const { resolveSelectedContract, selectRoom } = require("../services/roomSelectionService");
const { success, error: sendError } = require("../utils/response");

// GET /invoices
const getInvoices = async (req, res) => {
  try {
    const { status, year, month, contract, type, all } = req.query;
    const filter = { tenant: req.user._id };

    if (status) filter.status = status;
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    if (type) filter.type = type;

    // 🟢 SỬA LỖI "TẤT CẢ PHÒNG": Nhận diện keyword "all"
    if (contract && contract !== "all") {
      filter.contract = contract; // Lọc theo đúng 1 hợp đồng
    } else if (contract === "all" || all === "true") {
      // Bỏ qua lọc contract -> Lấy toàn bộ hóa đơn của tất cả phòng (kể cả cũ)
    } else {
      // Mặc định khi mới vào màn hình: lấy hóa đơn phòng đang chọn
      const { contract: selected } = await resolveSelectedContract(req.user._id);
      if (selected) filter.contract = selected._id;
    }

    const invoices = await Invoice.find(filter)
      .populate("room", "roomNumber")
      .populate("contract", "contractNumber roomNumber status")
      .sort({ year: -1, month: -1 });

    return success(res, invoices, "Lấy danh sách hóa đơn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /invoices/rooms
const getInvoiceRooms = async (req, res) => {
  try {
    // 🟢 SỬA LỖI HỢP ĐỒNG CŨ: Lấy TẤT CẢ hợp đồng của user, bất kể status
    const contracts = await Contract.find({ tenant: req.user._id })
      .populate("room", "roomNumber")
      .sort({ status: 1, createdAt: -1 }); // Ưu tiên hợp đồng active lên trước

    // Map lại danh sách phòng để ném vào Spinner cho App
    const rooms = contracts.map((c) => {
      // Nếu hợp đồng đã kết thúc/hủy, thêm đuôi để user phân biệt
      const suffix = c.status !== "active" ? " (Đã kết thúc)" : "";
      
      return {
        contractId: c._id,
        contractNumber: c.contractNumber,
        roomId: c.room?._id,
        roomNumber: (c.room?.roomNumber || "N/A") + suffix,
        isSelected: false // App tự handle logic này
      };
    });

    // 🟢 CHÈN OPTION "TẤT CẢ PHÒNG" LÊN ĐẦU DANH SÁCH
    rooms.unshift({
      contractId: "all",
      contractNumber: "",
      roomId: "all",
      roomNumber: "Tất cả phòng",
      isSelected: true
    });

    return success(res, rooms, "Lấy danh sách phòng thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /invoices/:id
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenant: req.user._id,
    })
      .populate({
        path: "room",
        select: "roomNumber floor",
        populate: {
          path: "floor",
          select: "name floorNumber",
        },
      })
      .populate("contract", "contractNumber roomNumber status startDate endDate");

    if (!invoice) return sendError(res, "Không tìm thấy hóa đơn", 404);

    return success(res, invoice, "Lấy thông tin hóa đơn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PATCH /invoices/select-room
const selectInvoiceRoom = async (req, res) => {
  try {
    const { contractId } = req.body;
    // Chặn việc chọn "Tất cả phòng" làm phòng mặc định
    if (contractId !== "all") {
        await selectRoom(req.user._id, contractId);
    }
    return getInvoices(req, res);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    return sendError(res, err.message);
  }
};

module.exports = {
  getInvoices,
  getInvoiceById,
  getInvoiceRooms,
  selectInvoiceRoom,
};