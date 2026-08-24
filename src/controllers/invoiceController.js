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

    // 🟢 SỬA LỖI TẠI ĐÂY: Lấy hóa đơn chính xác theo hợp đồng
    if (contract && contract !== "all") {
      const selectedContract = await Contract.findById(contract);
      
      if (selectedContract) {
        filter.contract = contract;
      } else {
        filter.contract = contract;
      }
    } else if (contract === "all" || all === "true") {
      // Bỏ qua lọc contract -> Lấy toàn bộ
    } else {
      // Mặc định: lấy hóa đơn phòng đang được set active
      const { contract: selected } = await resolveSelectedContract(req.user._id);
      if (selected) filter.contract = selected._id;
    }

    let dbQuery = Invoice.find(filter)
      .populate("room", "roomNumber")
      .populate("contract", "contractNumber roomNumber status")
      .sort({ year: -1, month: -1 });

    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      dbQuery = dbQuery.skip(skip).limit(limit);
    }

    const invoices = await dbQuery;

    return success(res, invoices, "Lấy danh sách hóa đơn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /invoices/rooms
const getInvoiceRooms = async (req, res) => {
  try {
    const { contract: selectedContract } = await resolveSelectedContract(req.user._id);

    const contracts = await Contract.find({ tenant: req.user._id })
      .populate("room", "roomNumber")
      .sort({ status: 1, createdAt: -1 });

    const rooms = contracts.map((c) => {
      const suffix = c.status !== "active" ? " (Đã kết thúc)" : "";
      const rName = c.room?.roomNumber || "N/A";
      const cName = c.contractNumber || "HD";
      
      const isSelected = selectedContract ? c._id.toString() === selectedContract._id.toString() : false;

      return {
        contractId: c._id,
        contractNumber: c.contractNumber,
        roomId: c.room?._id,
        roomNumber: `${rName} - ${cName}${suffix}`,
        isSelected: isSelected
      };
    });

    rooms.unshift({
      contractId: "all",
      contractNumber: "",
      roomId: "all",
      roomNumber: "Tất cả phòng",
      isSelected: false
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
    
    if (contractId && contractId !== "all") {
      // 🟢 SỬA LỖI TẠI ĐÂY: Chỉ lưu làm phòng mặc định nếu hợp đồng còn hiệu lực (active). 
      // Hợp đồng cũ chỉ dùng để lọc hóa đơn, không được set làm phòng hiện tại.
      const contract = await Contract.findById(contractId);
      if (contract && contract.status === "active") {
        await selectRoom(req.user._id, contractId);
      }
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