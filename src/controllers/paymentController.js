// src/controllers/paymentController.js
const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const Contract = require("../models/Contract");
const { success, error: sendError } = require("../utils/response");
const { createAndPushNotification } = require("../services/notificationService");

const BASE_URL = process.env.PUBLIC_URL || "http://localhost:8080";

const BANK_CODE = process.env.BANK_CODE;
const BANK_ACCOUNT = process.env.BANK_ACCOUNT;
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME;
const VIETQR_TEMPLATE = process.env.VIETQR_TEMPLATE || "compact";

const removeVietnameseTones = (str = "") => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
};

const buildPaymentContent = (invoice, tenant) => {
  const room = invoice.room?.roomNumber || "";
  const name = removeVietnameseTones(tenant.fullName || "");
  return `${name} P${room} T${invoice.month}/${invoice.year}`
    .replace(/\s+/g, " ")
    .trim();
};

const generateVietQRUrl = (amount, addInfo) => {
  const base = `https://img.vietqr.io/image/${BANK_CODE}-${BANK_ACCOUNT}-${VIETQR_TEMPLATE}.png`;
  const params = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo,
    accountName: BANK_ACCOUNT_NAME,
  });
  return `${base}?${params.toString()}`;
};

// POST /payments/create-session
const createPaymentSession = async (req, res) => {
  try {
    console.log("PAYMENT BODY:", req.body); // TODO: xoá log này khi đã fix xong

    const { invoiceId, amount, method = "qr" } = req.body;

    if (
      !invoiceId ||
      amount === undefined ||
      amount === null ||
      amount === ""
    ) {
      return sendError(res, "Thiếu thông tin thanh toán", 400);
    }

    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return sendError(res, "Số tiền thanh toán không hợp lệ", 400);
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenant: req.user._id,
    }).populate("room", "roomNumber");

    if (!invoice) return sendError(res, "Không tìm thấy hóa đơn", 404);
    if (invoice.status === "paid")
      return sendError(res, "Hóa đơn đã được thanh toán", 400);

    // Hóa đơn đã bị hủy (thường là hóa đơn cọc của hợp đồng đã hết hạn/bị
    // hủy trước khi tenant kịp thanh toán) -> không cho thanh toán nữa.
    if (invoice.status === "cancelled") {
      return sendError(
        res,
        "Hóa đơn này đã bị hủy do hợp đồng liên quan đã kết thúc, không thể thanh toán",
        400,
      );
    }

    // Hóa đơn tiền cọc: chỉ cho thanh toán khi hợp đồng liên quan vẫn còn hiệu lực.
    if (invoice.type === "deposit" && invoice.contract) {
      const contract = await Contract.findById(invoice.contract);
      if (contract && contract.status !== "active") {
        return sendError(
          res,
          "Hợp đồng liên quan không còn hiệu lực, không thể thanh toán tiền cọc",
          400,
        );
      }
    }

    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (numericAmount > remaining) {
      return sendError(
        res,
        `Số tiền thanh toán vượt quá số còn lại: ${remaining}`,
        400,
      );
    }

    const addInfo = buildPaymentContent(invoice, req.user);
    const qrUrl = generateVietQRUrl(numericAmount, addInfo);

    const payment = await Payment.create({
      tenant: req.user._id,
      invoice: invoiceId,
      amount: numericAmount,
      method,
      qrData: addInfo,
      status: "pending",
    });

    return success(
      res,
      {
        paymentId: payment._id,
        payToken: payment.payToken,
        qrUrl,
        qrContent: addInfo,
        confirmUrl: `${BASE_URL}/pay/${payment.payToken}`,
        bankInfo: {
          bankCode: BANK_CODE,
          accountNumber: BANK_ACCOUNT,
          accountName: BANK_ACCOUNT_NAME,
        },
      },
      "Tạo phiên thanh toán thành công",
      201,
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /pay/:token — trang HTML công khai để xác nhận (không cần đăng nhập)
const renderPaymentPage = async (req, res) => {
  try {
    const payment = await Payment.findOne({ payToken: req.params.token })
      .populate("tenant", "fullName")
      .populate({
        path: "invoice",
        populate: { path: "room", select: "roomNumber" },
      });

    if (!payment) {
      return res
        .status(404)
        .send(renderHtml("Không tìm thấy phiên thanh toán", "", false));
    }

    if (payment.status === "success") {
      return res.send(
        renderHtml(
          "Đã thanh toán thành công",
          `Hóa đơn tháng ${payment.invoice.month}/${payment.invoice.year} đã được xác nhận.`,
          false,
        ),
      );
    }

    const room = payment.invoice.room?.roomNumber || "";
    const amountText = payment.amount.toLocaleString("vi-VN") + "đ";

    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Xác nhận thanh toán</title>
        <style>
          body { font-family: sans-serif; background: #f5f5f5; margin: 0; padding: 24px; }
          .card { background: #fff; border-radius: 16px; padding: 24px; max-width: 400px; margin: 40px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
          .amount { font-size: 28px; font-weight: bold; color: #2196F3; margin: 16px 0; }
          .info { color: #666; margin-bottom: 24px; }
          button { background: #2196F3; color: #fff; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; }
          button:disabled { background: #999; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Xác nhận thanh toán</h2>
          <div class="info">Phòng ${room} — Hóa đơn tháng ${payment.invoice.month}/${payment.invoice.year}</div>
          <div class="amount">${amountText}</div>
          <button id="btnConfirm" onclick="confirmPay()">Xác nhận đã thanh toán</button>
          <p id="msg" style="margin-top:16px; color: green;"></p>
        </div>
        <script>
          async function confirmPay() {
            const btn = document.getElementById('btnConfirm');
            btn.disabled = true;
            btn.innerText = 'Đang xử lý...';
            try {
              const res = await fetch('/pay/${req.params.token}/confirm', { method: 'POST' });
              const data = await res.json();
              if (data.success) {
                document.getElementById('msg').innerText = 'Thanh toán thành công!';
                btn.style.display = 'none';
              } else {
                btn.disabled = false;
                btn.innerText = 'Xác nhận đã thanh toán';
                alert(data.message || 'Có lỗi xảy ra');
              }
            } catch (e) {
              btn.disabled = false;
              btn.innerText = 'Xác nhận đã thanh toán';
              alert('Lỗi kết nối');
            }
          }
        </script>
      </body>
      </html>
    `;

    return res.send(html);
  } catch (err) {
    return res.status(500).send(renderHtml("Lỗi hệ thống", err.message, false));
  }
};

const renderHtml = (title, message) => `
  <html><head><meta charset="utf-8"/></head>
  <body style="font-family:sans-serif; text-align:center; padding:40px;">
    <h2>${title}</h2>
    <p>${message}</p>
  </body></html>
`;

// POST /pay/:token/confirm — xử lý thanh toán thật (khách hàng bấm xác nhận)
const confirmPaymentByToken = async (req, res) => {
  try {
    const payment = await Payment.findOne({ payToken: req.params.token });

    if (!payment) return sendError(res, "Không tìm thấy phiên thanh toán", 404);
    if (payment.status === "success")
      return sendError(res, "Phiên thanh toán đã được xác nhận trước đó", 400);

    const invoice = await Invoice.findById(payment.invoice);
    if (!invoice) return sendError(res, "Không tìm thấy hóa đơn", 404);

    if (invoice.status === "cancelled") {
      return sendError(
        res,
        "Hóa đơn này đã bị hủy do hợp đồng liên quan đã kết thúc, không thể thanh toán",
        400,
      );
    }

    // 1. Cập nhật thông tin Payment thành công
    payment.status = "success";
    payment.paidAt = new Date();
    payment.transactionId = `TXN_${Date.now()}`;

    if (req.file && req.file.path) {
      payment.receiptImage = req.file.path;
      invoice.receiptImage = req.file.path; // Lưu ảnh minh chứng
    }

    await payment.save();

    // 2. 🟢 THAY ĐỔI TẠI ĐÂY: Khi khách xác nhận xong, đưa hóa đơn về trạng thái "pending" (Chờ duyệt)
    // Thay vì cộng tiền ngay vào paidAmount và đổi thành paid, ta giữ nguyên hoặc để admin duyệt xong mới tính.
    // Hoặc nếu bạn vẫn muốn cộng paidAmount nhưng ép status thành "pending":
    invoice.status = "pending"; 
    await invoice.save();

    // 3. Gửi thông báo cho Tenant biết đã gửi yêu cầu chờ admin duyệt
    await createAndPushNotification({
      tenant: payment.tenant,
      title: "Đã gửi minh chứng thanh toán",
      body: `Hóa đơn tháng ${invoice.month}/${invoice.year} đang chờ quản lý xác nhận.`,
      type: "invoice",
      refId: invoice._id,
      refModel: "Invoice",
      meta: { paymentId: payment._id },
    });

    return success(res, { payment, invoice }, "Đã gửi xác nhận thanh toán, vui lòng chờ Admin duyệt");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /payments/status/:token — app poll để biết đã confirm chưa (cần đăng nhập)
const getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      payToken: req.params.token,
      tenant: req.user._id,
    }).populate("invoice", "month year totalAmount paidAmount status");

    if (!payment) return sendError(res, "Không tìm thấy phiên thanh toán", 404);

    // Bọc theo cùng shape { payment, invoice } như confirmPaymentByToken,
    // để Android dùng chung 1 model PaymentResult cho cả 2 API (tránh NPE)
    return success(
      res,
      { payment, invoice: payment.invoice },
      "Lấy trạng thái thành công",
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
      "Lấy lịch sử thanh toán thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  createPaymentSession,
  renderPaymentPage,
  confirmPaymentByToken,
  getPaymentStatus,
  getPaymentHistory,
};