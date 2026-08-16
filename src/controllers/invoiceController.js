//src/controllers/invoiceController.js
const Invoice = require("../models/Invoice");
const {
  resolveSelectedContract,
  listSelectableRooms,
  selectRoom,
} = require("../services/roomSelectionService");
const { success, error: sendError } = require("../utils/response");

// GET /invoices
// Hỗ trợ filter theo hợp đồng (contract) để tách riêng hóa đơn của từng
// hợp đồng khi tenant có nhiều hợp đồng cùng lúc, và theo type (rent/deposit).
//
// Mặc định (không truyền "contract" và không truyền "all=true"): chỉ trả hóa
// đơn của phòng đang được CHỌN (đồng bộ với Dashboard/chụp công tơ) — đúng
// yêu cầu "phần hiển thị bên invoice sẽ hiển thị phòng đang chọn".
// - Truyền "contract=<id>": xem hóa đơn của đúng hợp đồng đó.
// - Truyền "all=true": xem hóa đơn của TẤT CẢ phòng tenant từng thuê.
const getInvoices = async (req, res) => {
  try {
    const { status, year, month, contract, type, all } = req.query;
    const filter = { tenant: req.user._id };

    if (status) filter.status = status;
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    if (type) filter.type = type;

    if (contract) {
      filter.contract = contract;
    } else if (all !== "true") {
      // Mặc định: chỉ hiển thị hóa đơn của phòng ĐANG CHỌN (đồng bộ với
      // Dashboard/chụp công tơ) — đúng yêu cầu "phần hiển thị bên invoice sẽ
      // hiển thị phòng đang chọn". Truyền ?all=true để xem hóa đơn mọi phòng.
      const { contract: selected } = await resolveSelectedContract(
        req.user._id,
      );
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
// Danh sách phòng CHỈ theo hợp đồng còn hiệu lực (status "active") để hiển
// thị bộ lọc/chuyển phòng ở màn Hóa đơn. Trước đây màn này dùng chung
// GET /contracts (trả về TẤT CẢ hợp đồng, mọi trạng thái) nên hợp đồng đã bị
// hủy/hết hạn vẫn hiện ra — gây trùng phòng (vd. phòng P202 hiện 2 lần vì có
// 1 hợp đồng cũ đã hủy). Endpoint này chỉ trả hợp đồng active nên không còn
// bị trùng/lẫn hợp đồng đã hủy nữa.
const getInvoiceRooms = async (req, res) => {
  try {
    const rooms = await listSelectableRooms(req.user._id);
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
// Cho phép chuyển "phòng đang chọn" ngay tại màn hóa đơn (dùng chung phòng
// đang chọn với Dashboard/chụp công tơ). Hợp đồng của phòng muốn chuyển tới
// bắt buộc phải còn hiệu lực (status "active").
const selectInvoiceRoom = async (req, res) => {
  try {
    const { contractId } = req.body;
    await selectRoom(req.user._id, contractId);
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