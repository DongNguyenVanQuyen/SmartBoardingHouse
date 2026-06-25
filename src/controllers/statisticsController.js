//src/controllers/statisticsController.js
const Invoice = require("../models/Invoice");
const MeterReading = require("../models/MeterReading");
const Payment = require("../models/Payment");
const { success, error: sendError } = require("../utils/response");

// GET /statistics/monthly?year=2024&month=6
const getMonthlyStatistics = async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;

    // Validate month
    if (m < 1 || m > 12) {
      return sendError(res, "Tháng phải từ 1 đến 12", 400);
    }

    const invoice = await Invoice.findOne({
      tenant: req.user._id,
      year: y,
      month: m,
    }).populate("room", "roomNumber price");

    const meterReadings = await MeterReading.find({
      tenant: req.user._id,
      year: y,
      month: m,
    });

    const electricReading = meterReadings.find((r) => r.type === "electric");
    const waterReading = meterReadings.find((r) => r.type === "water");

    // Phân tích chi tiêu theo hạng mục
    const breakdown = [];
    if (invoice && invoice.items) {
      invoice.items.forEach((item) => {
        breakdown.push({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.total,
          percentage: Math.round((item.total / invoice.totalAmount) * 100),
        });
      });
    }

    const monthNames = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ];

    return success(
      res,
      {
        period: {
          year: y,
          month: m,
          monthName: monthNames[m - 1],
          fullDate: `${m}/${y}`,
        },
        summary: {
          totalAmount: invoice?.totalAmount || 0,
          paidAmount: invoice?.paidAmount || 0,
          debtAmount: (invoice?.totalAmount || 0) - (invoice?.paidAmount || 0),
          invoiceStatus: invoice?.status || "no_invoice",
          dueDate: invoice?.dueDate || null,
        },
        room: invoice?.room
          ? {
              roomNumber: invoice.room.roomNumber,
              monthlyRent: invoice.room.price,
            }
          : null,
        utilities: {
          electric: electricReading
            ? {
                usage: electricReading.usage,
                unitPrice: electricReading.unitPrice,
                cost: electricReading.totalCost,
                currentReading: electricReading.currentReading,
                previousReading: electricReading.previousReading,
                verified: electricReading.isVerified,
              }
            : null,
          water: waterReading
            ? {
                usage: waterReading.usage,
                unitPrice: waterReading.unitPrice,
                cost: waterReading.totalCost,
                currentReading: waterReading.currentReading,
                previousReading: waterReading.previousReading,
                verified: waterReading.isVerified,
              }
            : null,
        },
        breakdown,
      },
      "Lấy thống kê tháng thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /statistics/yearly?year=2024
const getYearlyStatistics = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const invoices = await Invoice.find({
      tenant: req.user._id,
      year,
    }).populate("room", "roomNumber price");

    // Tổng hợp theo tháng
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: [
        "Tháng 1",
        "Tháng 2",
        "Tháng 3",
        "Tháng 4",
        "Tháng 5",
        "Tháng 6",
        "Tháng 7",
        "Tháng 8",
        "Tháng 9",
        "Tháng 10",
        "Tháng 11",
        "Tháng 12",
      ][i],
      totalAmount: 0,
      paidAmount: 0,
      debtAmount: 0,
      status: "no_invoice",
    }));

    invoices.forEach((inv) => {
      const idx = inv.month - 1;
      monthlyData[idx] = {
        month: inv.month,
        monthName: [
          "Tháng 1",
          "Tháng 2",
          "Tháng 3",
          "Tháng 4",
          "Tháng 5",
          "Tháng 6",
          "Tháng 7",
          "Tháng 8",
          "Tháng 9",
          "Tháng 10",
          "Tháng 11",
          "Tháng 12",
        ][inv.month - 1],
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        debtAmount: inv.totalAmount - inv.paidAmount,
        status: inv.status,
      };
    });

    const totalYear = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const paidYear = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

    // Thống kê điện nước theo năm
    const meterReadings = await MeterReading.find({
      tenant: req.user._id,
      year,
    });

    const electricReadings = meterReadings.filter((r) => r.type === "electric");
    const waterReadings = meterReadings.filter((r) => r.type === "water");

    const electricTotal = electricReadings.reduce(
      (sum, r) => sum + (r.totalCost || 0),
      0,
    );
    const waterTotal = waterReadings.reduce(
      (sum, r) => sum + (r.totalCost || 0),
      0,
    );

    const electricUsage = electricReadings.reduce(
      (sum, r) => sum + (r.usage || 0),
      0,
    );
    const waterUsage = waterReadings.reduce(
      (sum, r) => sum + (r.usage || 0),
      0,
    );

    // Thống kê trạng thái thanh toán
    const statusStats = {
      paid: invoices.filter((i) => i.status === "paid").length,
      unpaid: invoices.filter((i) => i.status === "unpaid").length,
      partial: invoices.filter((i) => i.status === "partial").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
    };

    return success(
      res,
      {
        year,
        summary: {
          totalYear,
          paidYear,
          debtYear: totalYear - paidYear,
          monthsWithInvoice: invoices.length,
          averageMonthly:
            invoices.length > 0 ? Math.round(totalYear / invoices.length) : 0,
        },
        monthlyData,
        utilities: {
          electric: {
            totalUsage: electricUsage,
            totalCost: Math.round(electricTotal),
            averageUsage:
              electricReadings.length > 0
                ? Math.round(electricUsage / electricReadings.length)
                : 0,
            averageCost:
              electricReadings.length > 0
                ? Math.round(electricTotal / electricReadings.length)
                : 0,
            monthsRecorded: electricReadings.length,
          },
          water: {
            totalUsage: waterUsage,
            totalCost: Math.round(waterTotal),
            averageUsage:
              waterReadings.length > 0
                ? Math.round(waterUsage / waterReadings.length)
                : 0,
            averageCost:
              waterReadings.length > 0
                ? Math.round(waterTotal / waterReadings.length)
                : 0,
            monthsRecorded: waterReadings.length,
          },
        },
        paymentStatus: statusStats,
      },
      "Lấy thống kê năm thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getMonthlyStatistics, getYearlyStatistics };
