//src/routes/meterReadingRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { uploadMeterReading } = require("../configs/cloudinary");
const {
  getPreviousReading,
  scanMeterImage,
  createMeterReading,
  updateMeterReading,
  getMeterReadingHistory,
  getMyMeterRooms,
} = require("../controllers/meterReadingController");

/**
 * @swagger
 * tags:
 *   name: MeterReadings
 *   description: Chỉ số điện / nước — chụp ảnh, Gemini AI đọc số, người dùng xác nhận rồi lưu
 */

/**
 * @swagger
 * /meter-readings/rooms:
 *   get:
 *     summary: Danh sách phòng (theo hợp đồng active) để chọn khi ghi chỉ số
 *     description: >
 *       Dùng cho màn hình chọn phòng khi tenant có từ 2 hợp đồng đang thuê trở lên.
 *       Nếu tenant chỉ có 1 hợp đồng thì không bắt buộc gọi API này — các API
 *       khác sẽ tự dùng hợp đồng duy nhất đó.
 *     tags: [MeterReadings]
 *     responses:
 *       200:
 *         description: Danh sách phòng (contractId, roomId, roomNumber)
 */
router.get("/rooms", protect, getMyMeterRooms);

/**
 * @swagger
 * /meter-readings/previous:
 *   get:
 *     summary: Lấy chỉ số kỳ trước + trạng thái tháng này (đã gửi chưa)
 *     description: Gọi khi mở màn nhập chỉ số — hiển thị sẵn số tháng trước (không cho sửa) và thông báo nếu tháng này đã gửi rồi.
 *     tags: [MeterReadings]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [electric, water]
 *         description: Loại công tơ
 *       - in: query
 *         name: contract
 *         schema:
 *           type: string
 *         description: >
 *           ID hợp đồng/phòng muốn ghi chỉ số. Bắt buộc nếu tenant đang có từ
 *           2 hợp đồng active trở lên (lấy từ GET /meter-readings/rooms).
 *     responses:
 *       200:
 *         description: Thông tin chỉ số kỳ trước
 *       400:
 *         description: Tenant có nhiều phòng — cần chọn phòng (kèm danh sách phòng trong errors.contracts)
 *       404:
 *         description: Tenant chưa có phòng đang thuê
 */
router.get("/previous", protect, getPreviousReading);

/**
 * @swagger
 * /meter-readings/scan:
 *   post:
 *     summary: Chụp ảnh → Gemini AI đọc số công tơ (chưa lưu DB)
 *     description: >
 *       Bước 1 — client gọi ngay khi người dùng chụp/chọn ảnh.
 *       Gemini AI đọc số LCD/cơ trên công tơ và trả về suggestedReading để hiển thị lên ô nhập
 *       cho người dùng xem và sửa lại nếu cần, trước khi bấm "Gửi" gọi POST /meter-readings.
 *       Nếu tháng này đã có chỉ số thì trả thêm existing để client hỏi người dùng có muốn cập nhật không.
 *     tags: [MeterReadings]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, image]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [electric, water]
 *               contract:
 *                 type: string
 *                 description: >
 *                   ID hợp đồng/phòng muốn chụp. Bắt buộc nếu tenant đang có
 *                   từ 2 hợp đồng active trở lên.
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh công tơ (chụp camera hoặc chọn từ thư viện)
 *     responses:
 *       200:
 *         description: Trả về imageUrl + suggestedReading (Gemini đọc) + existing nếu tháng này đã gửi rồi
 *       400:
 *         description: Thiếu ảnh, loại công tơ, hoặc tenant có nhiều phòng cần chọn phòng
 */
router.post(
  "/scan",
  protect,
  uploadMeterReading.single("image"),
  scanMeterImage,
);

/**
 * @swagger
 * /meter-readings:
 *   post:
 *     summary: Lưu chỉ số điện/nước (người dùng đã xác nhận số)
 *     description: >
 *       Bước 2 — gọi sau khi người dùng xem/sửa suggestedReading từ /scan và bấm "Gửi".
 *       Có thể truyền imageUrl (từ bước /scan) hoặc upload thẳng file image ở đây.
 *       Tháng/năm/previousReading do SERVER tự xác định.
 *       Nếu tháng này đã có chỉ số → trả 409 kèm dữ liệu existing, client dùng PATCH /:id để cập nhật.
 *     tags: [MeterReadings]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, currentReading]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [electric, water]
 *               currentReading:
 *                 type: number
 *                 description: Chỉ số hiện tại (đã xem/sửa lại sau Gemini gợi ý)
 *               unitPrice:
 *                 type: number
 *                 description: Giá/đơn vị (bỏ trống dùng mặc định theo loại)
 *               imageUrl:
 *                 type: string
 *                 description: URL ảnh lấy từ bước /scan (nếu đã gọi bước đó)
 *               ocrRawText:
 *                 type: string
 *                 description: Raw text Gemini đọc được (từ bước /scan)
 *               contract:
 *                 type: string
 *                 description: >
 *                   ID hợp đồng/phòng muốn lưu chỉ số. Bắt buộc nếu tenant
 *                   đang có từ 2 hợp đồng active trở lên (nên truyền lại
 *                   đúng contractId đã lấy từ bước /previous hoặc /scan).
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Upload ảnh trực tiếp (nếu không qua bước /scan)
 *     responses:
 *       201:
 *         description: Lưu thành công
 *       400:
 *         description: Thiếu thông tin / chỉ số không hợp lệ / chưa có ảnh / tenant có nhiều phòng cần chọn phòng
 *       409:
 *         description: Đã gửi chỉ số tháng này rồi — dùng PATCH /:id để cập nhật
 */
router.post(
  "/",
  protect,
  uploadMeterReading.single("image"),
  createMeterReading,
);

/**
 * @swagger
 * /meter-readings/{id}:
 *   patch:
 *     summary: Cập nhật chỉ số đã gửi trong tháng (chụp lại / sửa số)
 *     description: >
 *       Chỉ cho phép cập nhật khi Admin chưa xác nhận (isVerified = false).
 *       Sau khi cập nhật, invoice tháng này sẽ được tính lại tự động.
 *     tags: [MeterReadings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của MeterReading cần cập nhật (lấy từ existingId trong response 409)
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               currentReading:
 *                 type: number
 *               imageUrl:
 *                 type: string
 *               ocrRawText:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mới nếu chụp lại
 *     responses:
 *       200:
 *         description: Cập nhật thành công, invoice tháng này được tính lại
 *       403:
 *         description: Admin đã xác nhận, không thể chỉnh sửa
 *       404:
 *         description: Không tìm thấy chỉ số
 */
router.patch(
  "/:id",
  protect,
  uploadMeterReading.single("image"),
  updateMeterReading,
);

/**
 * @swagger
 * /meter-readings/history:
 *   get:
 *     summary: Lịch sử chỉ số điện/nước
 *     tags: [MeterReadings]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [electric, water]
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: contract
 *         schema:
 *           type: string
 *         description: Lọc theo hợp đồng/phòng cụ thể
 *     responses:
 *       200:
 *         description: Danh sách chỉ số
 */
router.get("/history", protect, getMeterReadingHistory);

module.exports = router;