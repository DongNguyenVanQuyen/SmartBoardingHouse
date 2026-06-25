//src/controllers/paymentController.js
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const { success, error: sendError } = require("../utils/response");

// Tạo nội dung QR VietQR
const generateQRData = (invoice, tenant, amount) => {
  // Format chuẩn VietQR / Bank transfer
  return `Phong ${invoice.room?.roomNumber || ""} - Thang ${invoice.month}/${invoice.year} - ${tenant.fullName}`;
};

// POST /payments
const createPayment = async (req, res) => {
  try {
    const { invoiceId, amount, method = "qr" } = req.body;

    if (!invoiceId || !amount) {
      return sendError(res, "Thiếu thông tin thanh toán", 400);
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenant: req.user._id,
    }).populate("room", "roomNumber");

    if (!invoice) return sendError(res, "Không tìm thấy hóa đơn", 404);
    if (invoice.status === "paid")
      return sendError(res, "Hóa đơn đã được thanh toán", 400);

    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (amount > remaining) {
      return sendError(
        res,
        `S�?tiền thanh toán vượt quá s�?còn lại: ${remaining}`,
        400,
      );
    }

    const qrData = generateQRData(invoice, req.user, amount);

    const payment = await Payment.create({
      tenant: req.user._id,
      invoice: invoiceId,
      amount,
      method,
      qrData,
      status: "pending",
    });

    // Thực t�? webhook t�?ngân hàng s�?confirm payment
    // Demo: t�?confirm luôn
    payment.status = "success";
    payment.paidAt = new Date();
    payment.transactionId = `TXN_${Date.now()}`;
    await payment.save();

    // Cập nhật hóa đơn
    invoice.paidAmount += amount;
    if (invoice.paidAmount >= invoice.totalAmount) {
      invoice.status = "paid";
    } else {
      invoice.status = "partial";
    }
    await invoice.save();

    return success(
      res,
      { payment, invoice, qrData },
      "Thanh toán thành công",
      201,
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /payments/history
const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find({ tenant: req.user._id })
        .populate("invoice", "month year totalAmount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payment.countDocuments({ tenant: req.user._id }),
    ]);

    return success(
      res,
      {
        payments,
        pagination: { page: parseInt(page), limit: parseInt(limit), total },
      },
      "Lấy lịch s�?thanh toán thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { createPayment, getPaymentHistory };

