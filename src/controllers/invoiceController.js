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

    // 🟢 ĐÃ SỬA: Lọc chính xác giá trị "all"
    if (contract && contract !== "all") {
      filter.contract = contract;
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
    // Lấy TẤT CẢ hợp đồng của user, bất kể status để user có thể xem lại HD cũ
    const contracts = await Contract.find({ tenant: req.user._id })
      .populate("room", "roomNumber")
      .sort({ status: 1, createdAt: -1 }); // Ưu tiên hợp đồng active lên trước

    const rooms = contracts.map((c) => {
      // Đánh dấu để người dùng biết HD nào đã kết thúc
      const suffix = c.status !== "active" ? " (Đã kết thúc)" : "";
      
      const rName = c.room?.roomNumber || "N/A";
      const cName = c.contractNumber || "HD";
      
      return {
        contractId: c._id,
        contractNumber: c.contractNumber,
        roomId: c.room?._id,
        // 🟢 ĐÃ SỬA: Gộp Tên Phòng - Tên Hợp Đồng
        roomNumber: `${rName} - ${cName}${suffix}`,
        isSelected: false 
      };
    });

    // Chèn lựa chọn "Tất cả phòng" lên đầu danh sách
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
    
    // Nếu không phải chọn "all" thì lưu vào phòng mặc định
    if (contractId !== "all") {
      await selectRoom(req.user._id, contractId);
    }
    
    // 🟢 ĐÃ SỬA CỐT LÕI TẠI ĐÂY: Gán contractId từ body sang query để hàm getInvoices hiểu được
    req.query = req.query || {};
    req.query.contract = contractId;

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