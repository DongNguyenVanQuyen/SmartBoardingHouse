//src/controllers/reportController.js
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const MeterReading = require("../models/MeterReading");
const { success, error: sendError } = require("../utils/response");

// GET /reports/monthly?year=2024&month=6
const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;

    const [invoice, payments, meterReadings] = await Promise.all([
      Invoice.findOne({ tenant: req.user._id, year: y, month: m }).populate(
        "room",
        "roomNumber floor",
      ),
      Payment.find({
        tenant: req.user._id,
        createdAt: {
          $gte: new Date(y, m - 1, 1),
          $lte: new Date(y, m, 0, 23, 59, 59),
        },
        status: "success",
      }),
      MeterReading.find({ tenant: req.user._id, year: y, month: m }),
    ]);

    const report = {
      generatedAt: new Date(),
      period: {
        month: m,
        year: y,
        label: `Tháng ${m}/${y}`,
      },
      tenant: {
        name: req.user.fullName,
        phone: req.user.phone,
        email: req.user.email,
      },
      room: invoice?.room || null,
      invoice: invoice
        ? {
            totalAmount: invoice.totalAmount,
            paidAmount: invoice.paidAmount,
            remainingAmount: invoice.totalAmount - invoice.paidAmount,
            status: invoice.status,
            dueDate: invoice.dueDate,
            items: invoice.items,
          }
        : null,
      payments: payments.map((p) => ({
        amount: p.amount,
        method: p.method,
        transactionId: p.transactionId,
        paidAt: p.paidAt,
      })),
      meterReadings: {
        electric: meterReadings.find((r) => r.type === "electric") || null,
        water: meterReadings.find((r) => r.type === "water") || null,
      },
    };

    return success(res, report, "Xuất báo cáo tháng thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getMonthlyReport };

