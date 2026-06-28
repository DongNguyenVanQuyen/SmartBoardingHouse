//src/controllers/meterReadingController.js
const MeterReading = require("../models/MeterReading");
const { generateInvoice } = require("../services/invoiceService");
const Contract = require("../models/Contract");
const { success, error: sendError } = require("../utils/response");

const Tesseract = require("tesseract.js");

// OCR thật bằng Tesseract.js — đọc text từ ảnh, tách số có nhiều chữ số nhất
// (chỉ số công tơ thường là số dài nhất trong ảnh, các số khác như điện áp "220V",
// tần số "50Hz", năm sản xuất... thường ngắn hơn)
const runOCR = async (imageUrl) => {
  const { data } = await Tesseract.recognize(imageUrl, "eng");
  const rawText = (data.text || "").trim();

  // Tách các chuỗi số (cho phép số thập phân, vd "9985.3")
  const matches = rawText.match(/\d+(\.\d+)?/g) || [];

  let best = null;
  for (const m of matches) {
    const digitCount = m.replace(".", "").length;
    if (!best || digitCount > best.digitCount) {
      best = { value: m, digitCount };
    }
  }

  return {
    rawText: rawText.slice(0, 500), // tránh lưu quá dài vào DB
    suggestedReading: best ? parseFloat(best.value) : null,
  };
};

// Helper: tìm chỉ số kỳ gần nhất trước tháng/năm hiện tại (dùng chung cho cả 2 API dưới)
const findPreviousReading = async (roomId, type, month, year) => {
  const lastReading = await MeterReading.findOne({
    room: roomId,
    type,
    $or: [{ year, month: { $lt: month } }, { year: { $lt: year } }],
  }).sort({ year: -1, month: -1 });

  return lastReading ? lastReading.currentReading : 0;
};

// GET /meter-readings/previous?type=electric
// Hiển thị sẵn chỉ số tháng trước khi mở form, KHÔNG cho sửa
const getPreviousReading = async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || !["electric", "water"].includes(type)) {
      return sendError(res, "Vui lòng chọn loại công tơ (electric/water)", 400);
    }

    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    });
    if (!contract) return sendError(res, "Bạn chưa có phòng đang thuê", 404);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Nếu tháng này đã có chỉ số rồi thì trả luôn để client biết (tránh nhập trùng)
    const existing = await MeterReading.findOne({
      room: contract.room,
      type,
      month,
      year,
    });

    const previousReading = await findPreviousReading(
      contract.room,
      type,
      month,
      year,
    );

    return success(
      res,
      {
        type,
        month,
        year,
        previousReading,
        alreadySubmitted: !!existing,
        existing: existing || null,
      },
      "Lấy chỉ số tháng trước thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /meter-readings/scan
// Upload ảnh công tơ -> OCR đọc số -> trả về cho client hiển thị lên ô currentReading để xem/sửa
// CHƯA lưu vào DB ở bước này.
const scanMeterImage = async (req, res) => {
  try {
    if (!req.file) return sendError(res, "Vui lòng chọn ảnh công tơ", 400);

    const imageUrl = req.file.path; // Cloudinary URL
    const { rawText, suggestedReading } = await runOCR(imageUrl);

    return success(
      res,
      {
        imageUrl,
        ocrRawText: rawText,
        suggestedReading, // client hiển thị lên ô currentReading, cho sửa lại — có thể null nếu OCR không đọc được
      },
      suggestedReading != null
        ? "Đọc chỉ số từ ảnh thành công"
        : "Không đọc được số rõ trong ảnh, vui lòng nhập tay",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /meter-readings
// Xác nhận lưu chỉ số. Client gửi: type, currentReading (đã xem/sửa sau OCR),
// imageUrl + ocrRawText (lấy từ /meter-readings/scan ở bước trước, không bắt buộc).
// month/year/previousReading do SERVER tự xác định — không nhận từ client.
const createMeterReading = async (req, res) => {
  try {
    const { type, currentReading, unitPrice, imageUrl, ocrRawText } = req.body;

    if (!type || currentReading === undefined || currentReading === null) {
      return sendError(res, "Thiếu thông tin chỉ số", 400);
    }
    if (!["electric", "water"].includes(type)) {
      return sendError(res, "Loại công tơ không hợp lệ", 400);
    }

    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    });
    if (!contract) return sendError(res, "Bạn chưa có phòng đang thuê", 404);

    // Tháng/năm luôn lấy theo thời gian thực tế lúc gửi — không cho client tự chọn
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Chặn gửi 2 lần trong cùng 1 tháng cho cùng loại công tơ
    const existing = await MeterReading.findOne({
      room: contract.room,
      type,
      month,
      year,
    });
    if (existing) {
      return sendError(res, `Bạn đã gửi chỉ số ${type} của tháng này rồi`, 400);
    }

    const previousReading = await findPreviousReading(
      contract.room,
      type,
      month,
      year,
    );

    const defaultUnitPrice = type === "electric" ? 3500 : 8000; // VND
    const finalCurrentReading = parseFloat(currentReading);

    if (finalCurrentReading < previousReading) {
      return sendError(
        res,
        `Chỉ số hiện tại (${finalCurrentReading}) không thể nhỏ hơn chỉ số kỳ trước (${previousReading})`,
        400,
      );
    }

    // Cho phép gửi kèm ảnh trực tiếp (nếu client không qua bước /scan riêng)
    let finalImageUrl = imageUrl || null;
    let finalOcrRawText = ocrRawText || null;
    if (req.file) {
      finalImageUrl = req.file.path;
      const ocrResult = await runOCR(finalImageUrl);
      finalOcrRawText = ocrResult.rawText;
    }

    const reading = await MeterReading.create({
      tenant: req.user._id,
      room: contract.room,
      roomNumber: contract.roomNumber,
      type,
      currentReading: finalCurrentReading,
      previousReading,
      unitPrice: unitPrice ? parseFloat(unitPrice) : defaultUnitPrice,
      imageUrl: finalImageUrl,
      ocrRawText: finalOcrRawText,
      readingDate: now,
      month,
      year,
      isVerified: false, // chờ admin xác nhận đối chiếu ảnh
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

    return success(res, readings, "Lấy lịch sử chỉ số thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  getPreviousReading,
  scanMeterImage,
  createMeterReading,
  getMeterReadingHistory,
};