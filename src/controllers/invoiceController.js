//src/controllers/invoiceController.js
const Invoice = require("../models/Invoice");
const { success, error: sendError } = require("../utils/response");

// GET /invoices
// Hỗ trợ filter theo hợp đồng (contract) để tách riêng hóa đơn của từng
// hợp đồng khi tenant có nhiều hợp đồng cùng lúc, và theo type (rent/deposit).
const getInvoices = async (req, res) => {
  try {
    const { status, year, month, contract, type } = req.query;
    const filter = { tenant: req.user._id };

    if (status) filter.status = status;
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    if (contract) filter.contract = contract;
    if (type) filter.type = type;

    const invoices = await Invoice.find(filter)
      .populate("room", "roomNumber")
      .populate("contract", "contractNumber roomNumber status")
      .sort({ year: -1, month: -1 });

    return success(res, invoices, "Lấy danh sách hóa đơn thành công");
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

module.exports = { getInvoices, getInvoiceById };