const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const MeterReading = require("../models/MeterReading");
const { success, error: sendError } = require("../utils/response");

// POST /api/debug/clear-month
// Xóa Invoice/Payment/MeterReading của tenant đang đăng nhập cho 1 tháng cụ thể
// (mặc định là tháng/năm hiện tại nếu không truyền lên) — dùng để test "qua tháng mới".
const clearMonthData = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return sendError(res, "Chức năng debug không khả dụng ở production", 403);
    }

    const tenantId = req.user._id;
    const now = new Date();
    const month = req.body.month || now.getMonth() + 1;
    const year = req.body.year || now.getFullYear();

    const invoices = await Invoice.find({ tenant: tenantId, month, year });
    const invoiceIds = invoices.map((i) => i._id);

    const paymentResult = await Payment.deleteMany({ invoice: { $in: invoiceIds } });
    const invoiceResult = await Invoice.deleteMany({ tenant: tenantId, month, year });
    const electricResult = await MeterReading.deleteMany({ tenant: tenantId, type: "electric", month, year });
    const waterResult = await MeterReading.deleteMany({ tenant: tenantId, type: "water", month, year });

    return success(
      res,
      {
        paymentsDeleted: paymentResult.deletedCount,
        invoicesDeleted: invoiceResult.deletedCount,
        electricDeleted: electricResult.deletedCount,
        waterDeleted: waterResult.deletedCount,
      },
      "Đã xóa dữ liệu tháng test",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { clearMonthData };