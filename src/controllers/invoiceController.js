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

    // 🟢 XỬ LÝ LỌC HÓA ĐƠN THEO KHOẢNG THỜI GIAN HỢP ĐỒNG (HỖ TRỢ CẢ HỢP ĐỒNG ĐÃ HẾT HẠN)
    if (contract && contract !== "all") {
      // Tìm thông tin hợp đồng được chọn để lấy mốc thời gian startDate và endDate
      const selectedContract = await Contract.findById(contract);
      if (selectedContract) {
        filter.contract = contract;

        // Nếu hợp đồng có ngày bắt đầu và kết thúc cụ thể, ta có thể lọc hóa đơn theo khoảng thời gian đó
        // (Dựa vào trường month và year của hóa đơn so với startDate/endDate của hợp đồng)
        if (selectedContract.startDate && selectedContract.endDate) {
          const startYear = new Date(selectedContract.startDate).getFullYear();
          const startMonth = new Date(selectedContract.startDate).getMonth() + 1;
          const endYear = new Date(selectedContract.endDate).getFullYear();
          const endMonth = new Date(selectedContract.endDate).getMonth() + 1;

          // Tạo điều kiện lọc tháng/năm nằm trong khoảng hợp đồng hiệu lực
          // (Chỉ áp dụng cho hóa đơn rent, hóa đơn deposit có thể giữ nguyên theo contract ID)
          if (!type || type === "rent") {
            filter.$or = [
              {
                year: { $gt: startYear, $lt: endYear },
              },
              {
                year: startYear,
                month: { $gte: startMonth },
                ...(startYear === endYear ? { month: { $gte: startMonth, $lte: endMonth } } : {}),
              },
              ...(startYear !== endYear ? [{
                year: endYear,
                month: { $lte: endMonth },
              }] : [])
            ];
          }
        }
      } else {
        filter.contract = contract;
      }
    } else if (contract === "all" || all === "true") {
      // Lấy toàn bộ hóa đơn của tất cả phòng
    } else {
      // Mặc định: lấy hóa đơn phòng đang chọn
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
    const contracts = await Contract.find({ tenant: req.user._id })
      .populate("room", "roomNumber")
      .sort({ status: 1, createdAt: -1 });

    const rooms = contracts.map((c) => {
      const suffix = c.status !== "active" ? " (Đã kết thúc)" : "";
      const rName = c.room?.roomNumber || "N/A";
      const cName = c.contractNumber || "HD";
      
      return {
        contractId: c._id,
        contractNumber: c.contractNumber,
        roomId: c.room?._id,
        roomNumber: `${rName} - ${cName}${suffix}`,
        isSelected: false 
      };
    });

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
    
    if (contractId !== "all") {
      await selectRoom(req.user._id, contractId);
    }
    
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