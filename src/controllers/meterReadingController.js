//src/controllers/meterReadingController.js
const MeterReading = require("../models/MeterReading");
const { generateInvoice } = require("../services/invoiceService");
const Contract = require("../models/Contract");
const { resolveSelectedContract } = require("../services/roomSelectionService");
const { success, error: sendError } = require("../utils/response");
const axios = require("axios");

// Dùng key 1, nếu lỗi quota/rate-limit thì fallback sang key 2
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
].filter(Boolean);

// env đặt tên "gemini-3-flash-preview" nhưng model thật trên AI Studio là "gemini-2.5-flash"
// (gemini-3 chưa public) → fallback an toàn
const GEMINI_MODEL = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";

// ─── Gemini OCR ────────────────────────────────────────────────────────────────
const runGeminiOCR = async (imageUrl) => {
  if (!GEMINI_KEYS.length)
    throw new Error("Chưa cấu hình GEMINI_API_KEY trong .env");

  // Tải ảnh về buffer (Nén ảnh Cloudinary để nhận diện cực nhanh)
  const optimizedImageUrl = imageUrl.replace('/upload/', '/upload/w_800,q_80/');
  const { data: imageBuffer } = await axios.get(optimizedImageUrl, {
    responseType: "arraybuffer",
    timeout: 10000,
  });
  const base64Image = Buffer.from(imageBuffer).toString("base64");

  const body = {
    contents: [
      {
        parts: [
          {
            text:
              "Đây là ảnh công tơ điện hoặc nước. " +
              "Hãy đọc CHÍNH XÁC số chỉ số tiêu thụ hiển thị trên màn LCD hoặc mặt số cơ. " +
              "KHÔNG đọc điện áp (220V), tần số (50Hz), mã sản xuất, hay số in trên thân công tơ. " +
              "Nếu có dấu thập phân thì giữ nguyên (vd: 9985.3). " +
              "Nếu không đọc rõ, trả reading = null. " +
              'Trả về JSON: { "reading": <number|null>, "note": "<mô tả ngắn>" }',
          },
          { inline_data: { mime_type: "image/jpeg", data: base64Image } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          reading: { type: "number", nullable: true },
          note: { type: "string" },
        },
        required: ["reading"],
      },
    },
  };

  let lastError;
  for (const key of GEMINI_KEYS) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
        body,
        { timeout: 60000 },
      );

      const textPart =
        res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      let parsed = {};
      try {
        parsed = JSON.parse(textPart);
      } catch {
        /* bỏ qua */
      }

      return {
        rawText: textPart.slice(0, 500),
        suggestedReading:
          typeof parsed.reading === "number" ? parsed.reading : null,
        note: parsed.note || "",
      };
    } catch (err) {
      lastError = err.response?.data?.error?.message || err.message;
      
      // Dịch lỗi nếu quá tải hoặc timeout
      if (lastError.includes("high demand") || lastError.includes("overloaded")) {
        lastError = "Hệ thống AI đang bị quá tải, vui lòng thử lại sau.";
      } else if (err.code === 'ECONNABORTED' || lastError.includes("timeout")) {
        lastError = "AI phản hồi chậm, vui lòng thử lại.";
      }

      // Thử key tiếp theo nếu lỗi 429 (quota), 403 (cấm), 503 (quá tải)
      const status = err.response?.status;
      if (status !== 429 && status !== 403 && status !== 503 && err.code !== 'ECONNABORTED')
        throw new Error(`Gemini error: ${lastError}`);
    }
  }
  throw new Error(`Gemini error (cả 2 key đều lỗi): ${lastError}`);
};

// ─── Helper ────────────────────────────────────────────────────────────────────
const findPreviousReading = async (roomId, type, month, year) => {
  const last = await MeterReading.findOne({
    room: roomId,
    type,
    $or: [{ year, month: { $lt: month } }, { year: { $lt: year } }],
  }).sort({ year: -1, month: -1 });
  return last ? last.currentReading : 0;
};

const getCurrentMonthReading = async (roomId, type, month, year) =>
  MeterReading.findOne({ room: roomId, type, month, year });

// Xác định hợp đồng (và phòng) mà tenant muốn ghi chỉ số — hỗ trợ trường hợp
// tenant có NHIỀU hợp đồng/phòng đang thuê cùng lúc.
//   - Nếu client truyền contractId -> dùng đúng hợp đồng đó (phải thuộc về
//     tenant hiện tại và đang active), rồi lấy dữ liệu phòng của hợp đồng đó.
//   - Nếu không truyền -> mặc định dùng đúng PHÒNG ĐANG CHỌN ở Dashboard
//     (Tenant.room, xem roomSelectionService) — để việc chụp công tơ luôn
//     khớp với phòng tenant đang xem trên Dashboard, kể cả khi họ đang thuê
//     nhiều phòng cùng lúc. Nếu Dashboard chưa từng chọn phòng nào (tenant
//     mới, dữ liệu cũ...) mà có từ 2 hợp đồng active trở lên, mới trả lỗi kèm
//     danh sách phòng để client hiển thị màn chọn phòng.
const resolveActiveContract = async (tenantId, contractId) => {
  if (contractId) {
    const contract = await Contract.findOne({
      _id: contractId,
      tenant: tenantId,
      status: "active",
    }).populate("room", "roomNumber");

    if (!contract) {
      const err = new Error(
        "Phòng/hợp đồng đã chọn không hợp lệ hoặc không còn hiệu lực",
      );
      err.statusCode = 404;
      throw err;
    }
    return contract;
  }

  const { contract: selectedContract, rooms } =
    await resolveSelectedContract(tenantId);

  if (selectedContract) return selectedContract;

  if (rooms.length === 0) {
    const err = new Error("Bạn chưa có phòng đang thuê");
    err.statusCode = 404;
    throw err;
  }

  // Trường hợp hiếm: có nhiều hợp đồng active nhưng chưa xác định được phòng
  // đang chọn (không nên xảy ra vì resolveSelectedContract tự chọn mặc định
  // hợp đồng gần nhất) — vẫn giữ lại lỗi kèm danh sách phòng để an toàn.
  const err = new Error(
    "Bạn đang thuê nhiều phòng — vui lòng chọn phòng muốn ghi chỉ số",
  );
  err.statusCode = 400;
  err.needsContractSelection = true;
  err.contracts = rooms.map((r) => ({
    contractId: r.contractId,
    roomId: r.roomId,
    roomNumber: r.roomNumber,
  }));
  throw err;
};

// Trả response lỗi thống nhất cho resolveActiveContract, kèm danh sách phòng
// để client hiển thị màn chọn phòng nếu cần.
const sendContractResolveError = (res, err) => {
  return sendError(
    res,
    err.message,
    err.statusCode || 400,
    err.needsContractSelection ? { contracts: err.contracts } : null,
  );
};

// ─── GET /meter-readings/previous?type=electric&contract=... ──────────────────
// Lấy chỉ số kỳ trước hiển thị sẵn khi mở form — không cho sửa.
// Tham số "contract" (tùy chọn): chọn đúng phòng/hợp đồng muốn xem, dùng khi
// tenant có nhiều hợp đồng cùng lúc.
const getPreviousReading = async (req, res) => {
  try {
    const { type, contract: contractId } = req.query;
    if (!type || !["electric", "water"].includes(type)) {
      return sendError(res, "Vui lòng chọn loại công tơ (electric/water)", 400);
    }

    const contract = await resolveActiveContract(req.user._id, contractId);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [previousReading, existing] = await Promise.all([
      findPreviousReading(contract.room, type, month, year),
      getCurrentMonthReading(contract.room, type, month, year),
    ]);

    return success(
      res,
      {
        type,
        month,
        year,
        contractId: contract._id,
        roomId: contract.room?._id || contract.room,
        roomNumber: contract.room?.roomNumber || contract.roomNumber,
        previousReading,
        alreadySubmitted: !!existing,
        existing: existing || null, // trả về để client hiển thị số + ảnh đã chụp trước đó
      },
      "Lấy chỉ số tháng trước thành công",
    );
  } catch (err) {
    if (err.statusCode) return sendContractResolveError(res, err);
    return sendError(res, err.message);
  }
};

// ─── POST /meter-readings/scan ─────────────────────────────────────────────────
// Upload ảnh → Gemini đọc số → trả về suggestedReading để client hiển thị lên ô nhập.
// CHƯA lưu DB. Nếu tháng này đã có chỉ số thì trả thêm existing để client hỏi người dùng.
// Body/form field "contract" (tùy chọn): chọn phòng/hợp đồng muốn chụp — bắt
// buộc nếu tenant đang có nhiều hợp đồng cùng lúc.
const scanMeterImage = async (req, res) => {
  try {
    if (!req.file) return sendError(res, "Vui lòng chụp ảnh công tơ", 400);

    const { type, contract: contractId } = req.body;
    if (!type || !["electric", "water"].includes(type)) {
      return sendError(res, "Vui lòng chọn loại công tơ (electric/water)", 400);
    }

    const contract = await resolveActiveContract(req.user._id, contractId);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const imageUrl = req.file.path; // Cloudinary URL

    // Chạy OCR + check existing song song
    const [ocrResult, existing] = await Promise.all([
      runGeminiOCR(imageUrl),
      getCurrentMonthReading(contract.room, type, month, year),
    ]);

    return success(
      res,
      {
        imageUrl,
        contractId: contract._id,
        roomId: contract.room?._id || contract.room,
        roomNumber: contract.room?.roomNumber || contract.roomNumber,
        ocrRawText: ocrResult.rawText,
        geminiNote: ocrResult.note,
        suggestedReading: ocrResult.suggestedReading,
        // Nếu đã có chỉ số tháng này → client cần hỏi người dùng có muốn cập nhật không
        alreadySubmitted: !!existing,
        existing: existing
          ? {
            id: existing._id,
            currentReading: existing.currentReading,
            imageUrl: existing.imageUrl,
            readingDate: existing.readingDate,
          }
          : null,
      },
      ocrResult.suggestedReading != null
        ? "Đọc chỉ số từ ảnh thành công — vui lòng kiểm tra lại trước khi lưu"
        : "Không đọc được số rõ trong ảnh, vui lòng nhập tay",
    );
  } catch (err) {
    if (err.statusCode) return sendContractResolveError(res, err);
    return sendError(res, err.message);
  }
};

// ─── POST /meter-readings ──────────────────────────────────────────────────────
// Lưu mới chỉ số. Nếu tháng này đã có rồi → báo lỗi kèm existing (client dùng PATCH để cập nhật).
// Body field "contract" (tùy chọn): chọn phòng/hợp đồng muốn lưu chỉ số — bắt
// buộc nếu tenant đang có nhiều hợp đồng cùng lúc (client nên truyền lại đúng
// contractId đã lấy từ bước /previous hoặc /scan).
const createMeterReading = async (req, res) => {
  try {
    const {
      type,
      currentReading,
      unitPrice,
      imageUrl,
      ocrRawText,
      contract: contractId,
    } = req.body;

    if (!type || currentReading == null)
      return sendError(res, "Thiếu thông tin chỉ số", 400);
    if (!["electric", "water"].includes(type))
      return sendError(res, "Loại công tơ không hợp lệ", 400);

    // Ảnh có thể đến từ upload trực tiếp (req.file) hoặc imageUrl từ bước /scan
    const finalImageUrl = req.file?.path || imageUrl || null;
    // if (!finalImageUrl)
    //   return sendError(
    //     res,
    //     "Vui lòng chụp ảnh công tơ để Admin đối chiếu",
    //     400,
    //   );

    const contract = await resolveActiveContract(req.user._id, contractId);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const roomId = contract.room?._id || contract.room;
    const roomNumber = contract.room?.roomNumber || contract.roomNumber;

    const existing = await getCurrentMonthReading(roomId, type, month, year);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Bạn đã gửi chỉ số ${type === "electric" ? "điện" : "nước"} tháng ${month}/${year} rồi (chỉ số: ${existing.currentReading}). Dùng API cập nhật nếu muốn thay đổi.`,
        data: {
          existingId: existing._id,
          currentReading: existing.currentReading,
          imageUrl: existing.imageUrl,
          readingDate: existing.readingDate,
          isVerified: existing.isVerified,
        },
      });
    }

    const previousReading = await findPreviousReading(
      roomId,
      type,
      month,
      year,
    );
    const finalCurrentReading = parseFloat(currentReading);

    if (finalCurrentReading < previousReading) {
      return sendError(
        res,
        `Chỉ số hiện tại (${finalCurrentReading}) không thể nhỏ hơn chỉ số kỳ trước (${previousReading})`,
        400,
      );
    }

    const activeFees = await require("../models/ItemFee").find({ isActive: true });
    const electricFee = activeFees.find(f => f.type === "electric" || (f.type === "mandatory" && f.name.toLowerCase().includes("điện")));
    const waterFee = activeFees.find(f => f.type === "water" || (f.type === "mandatory" && f.name.toLowerCase().includes("nước")));

    let defaultUnitPrice = type === "electric" ? 3500 : 8000;
    if (type === "electric" && electricFee) defaultUnitPrice = electricFee.price;
    if (type === "water" && waterFee) defaultUnitPrice = waterFee.price;


    const reading = await MeterReading.create({
      tenant: req.user._id,
      room: roomId,
      contract: contract._id,
      roomNumber,
      type,
      currentReading: finalCurrentReading,
      previousReading,
      unitPrice: unitPrice ? parseFloat(unitPrice) : defaultUnitPrice,
      imageUrl: finalImageUrl,
      ocrRawText: ocrRawText || null,
      readingDate: now,
      month,
      year,
      isVerified: false,
    });

    await generateInvoice(
      reading.tenant,
      reading.room,
      contract._id,
      reading.month,
      reading.year,
    );
    return success(res, reading, "Lưu chỉ số thành công", 201);
  } catch (err) {
    if (err.statusCode) return sendContractResolveError(res, err);
    return sendError(res, err.message);
  }
};

// ─── PATCH /meter-readings/:id ─────────────────────────────────────────────────
// Cập nhật chỉ số đã gửi tháng này (người dùng chụp lại / sửa số).
// Chỉ cho phép cập nhật nếu Admin chưa verify (isVerified = false).
const updateMeterReading = async (req, res) => {
  try {
    const reading = await MeterReading.findOne({
      _id: req.params.id,
      tenant: req.user._id,
    });

    if (!reading) return sendError(res, "Không tìm thấy chỉ số", 404);
    if (reading.isVerified) {
      return sendError(
        res,
        "Admin đã xác nhận chỉ số này, không thể chỉnh sửa",
        403,
      );
    }

    const { currentReading, unitPrice, imageUrl, ocrRawText } = req.body;
    const finalImageUrl = req.file?.path || imageUrl || reading.imageUrl;
    const finalCurrentReading = currentReading
      ? parseFloat(currentReading)
      : reading.currentReading;

    if (finalCurrentReading < reading.previousReading) {
      return sendError(
        res,
        `Chỉ số hiện tại (${finalCurrentReading}) không thể nhỏ hơn chỉ số kỳ trước (${reading.previousReading})`,
        400,
      );
    }

    const activeFees = await require("../models/ItemFee").find({ isActive: true });
    const electricFee = activeFees.find(f => f.type === "electric" || (f.type === "mandatory" && f.name.toLowerCase().includes("điện")));
    const waterFee = activeFees.find(f => f.type === "water" || (f.type === "mandatory" && f.name.toLowerCase().includes("nước")));

    let defaultUnitPrice = reading.type === "electric" ? 3500 : 8000;
    if (reading.type === "electric" && electricFee) defaultUnitPrice = electricFee.price;
    if (reading.type === "water" && waterFee) defaultUnitPrice = waterFee.price;

    reading.currentReading = finalCurrentReading;
    reading.imageUrl = finalImageUrl;
    reading.ocrRawText = ocrRawText || reading.ocrRawText;
    reading.unitPrice = unitPrice ? parseFloat(unitPrice) : defaultUnitPrice;
    reading.readingDate = new Date();
    await reading.save(); // pre-save hook tự tính lại usage + totalCost

    // Xác định hợp đồng để tách đúng hóa đơn: ưu tiên contract đã lưu sẵn
    // trên chỉ số, fallback sang hợp đồng active của tenant cho phòng này
    // (dữ liệu cũ tạo trước khi field "contract" tồn tại trên MeterReading).
    let contractId = reading.contract;
    if (!contractId) {
      const fallbackContract = await Contract.findOne({
        tenant: reading.tenant,
        room: reading.room,
        status: "active",
      });
      contractId = fallbackContract?._id;
    }

    if (contractId) {
      // Cập nhật lại invoice tháng này theo số mới
      await generateInvoice(
        reading.tenant,
        reading.room,
        contractId,
        reading.month,
        reading.year,
      );
    }
    return success(res, reading, "Cập nhật chỉ số thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── GET /meter-readings/history?contract=... ──────────────────────────────────
const getMeterReadingHistory = async (req, res) => {
  try {
    const { type, year, contract } = req.query;
    const filter = { tenant: req.user._id };
    if (type) filter.type = type;
    if (year) filter.year = parseInt(year);
    if (contract) filter.contract = contract;

    const readings = await MeterReading.find(filter)
      .populate("room", "roomNumber")
      .sort({ year: -1, month: -1 });

    return success(res, readings, "Lấy lịch sử chỉ số thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ─── GET /meter-readings/rooms ──────────────────────────────────────────────────
// Danh sách phòng (theo hợp đồng active) mà tenant có thể chọn để ghi chỉ số.
// Dùng cho màn hình chọn phòng khi tenant có nhiều hợp đồng cùng lúc.
const getMyMeterRooms = async (req, res) => {
  try {
    const { contract: selectedContract } = await resolveSelectedContract(req.user._id);

    const activeContracts = await Contract.find({
      tenant: req.user._id,
      status: "active",
    }).populate("room", "roomNumber floor");

    const rooms = activeContracts.map((c) => {
      const isSelected = selectedContract ? c._id.toString() === selectedContract._id.toString() : false;
      return {
        contractId: c._id,
        contractNumber: c.contractNumber,
        roomId: c.room?._id,
        roomNumber: c.room?.roomNumber || c.roomNumber,
        isSelected: isSelected
      };
    });

    return success(res, rooms, "Lấy danh sách phòng thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  getPreviousReading,
  scanMeterImage,
  createMeterReading,
  updateMeterReading,
  getMeterReadingHistory,
  getMyMeterRooms,
};