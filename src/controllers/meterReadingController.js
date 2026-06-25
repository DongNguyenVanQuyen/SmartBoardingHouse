//src/controllers/meterReadingController.js
const MeterReading = require("../models/MeterReading");
const generateInvoice = require("../services/invoiceService");
const Contract = require("../models/Contract");
const { success, error: sendError } = require("../utils/response");

// Giả lập OCR - thực tế dùng Google Vision API hoặc Tesseract
const simulateOCR = (imageUrl) => {
  // Placeholder: trả về số ngẫu nhiên để demo
  return Math.floor(Math.random() * 1000) + 100;
};

// POST /meter-readings
const createMeterReading = async (req, res) => {
  try {
    const { type, currentReading, previousReading, unitPrice, month, year } =
      req.body;

    if (!type || !currentReading || !month || !year) {
      return sendError(res, "Thiếu thông tin chỉ số", 400);
    }

    // Tìm phòng của tenant
    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    });

    if (!contract) return sendError(res, "Bạn chưa có phòng đang thuê", 404);

    let imageUrl = null;
    let ocrRawText = null;

    if (req.file) {
      imageUrl = req.file.path; // Cloudinary URL
      // Thực t�? gọi OCR service
      ocrRawText = `OCR detected: ${simulateOCR(imageUrl)}`;
    }

    // Lấy ch�?s�?tháng trước nếu không truyền vào
    let prevReading = previousReading;
    if (!prevReading) {
      const lastReading = await MeterReading.findOne({
        room: contract.room,
        type,
        $or: [
          { year: year, month: month - 1 },
          { year: year - 1, month: 12 },
        ],
      }).sort({ year: -1, month: -1 });

      prevReading = lastReading ? lastReading.currentReading : 0;
    }

    const defaultUnitPrice = type === "electric" ? 3500 : 15000; // VND

    const reading = await MeterReading.create({
      tenant: req.user._id,
      room: contract.room,
      type,
      currentReading: parseFloat(currentReading),
      previousReading: parseFloat(prevReading),
      unitPrice: unitPrice || defaultUnitPrice,
      imageUrl,
      ocrRawText,
      month: parseInt(month),
      year: parseInt(year),
    });
    await generateInvoice(
      reading.tenant,
      reading.room,
      reading.month,
      reading.year,
    );
    return success(res, reading, "Lưu chỉ số thành công", 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /meter-readings/history
const getMeterReadingHistory = async (req, res) => {
  try {
    const { type, year } = req.query;
    const filter = { tenant: req.user._id };

    if (type) filter.type = type;
    if (year) filter.year = parseInt(year);

    const readings = await MeterReading.find(filter)
      .populate("room", "roomNumber")
      .sort({ year: -1, month: -1 });

    return success(res, readings, "Lấy lịch s�?ch�?s�?thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { createMeterReading, getMeterReadingHistory };
