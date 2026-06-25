//src/controllers/invoiceController.js
const Invoice = require("../models/Invoice");
const { success, error: sendError } = require("../utils/response");

// GET /invoices
const getInvoices = async (req, res) => {
  try {
    const { status, year, month } = req.query;
    const filter = { tenant: req.user._id };

    if (status) filter.status = status;
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);

    const invoices = await Invoice.find(filter)
      .populate("room", "roomNumber")
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
    }).populate({
      path: "room",
      select: "roomNumber floor",
      populate: {
        path: "floor",
        select: "name floorNumber",
      },
    });

    if (!invoice) return sendError(res, "Không tìm thấy hóa đơn", 404);

    return success(res, invoice, "Lấy thông tin hóa đơn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getInvoices, getInvoiceById };
