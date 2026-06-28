//src/routes/meterReadingRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { uploadMeterReading } = require("../configs/cloudinary");
const {
  getPreviousReading,
  scanMeterImage,
  createMeterReading,
  getMeterReadingHistory,
} = require("../controllers/meterReadingController");

/**
 * @swagger
 * tags:
 *   name: MeterReadings
 *   description: Chỉ số điện / nước (chụp ảnh công tơ hoặc chọn ảnh từ thư viện)
 */

/**
 * @swagger
 * /meter-readings/previous:
 *   get:
 *     summary: Lấy chỉ số kỳ trước để hiển thị sẵn khi mở form (không cho sửa)
 *     tags: [MeterReadings]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [electric, water]
 *     responses:
 *       200:
 *         description: Chỉ số kỳ trước
 *       404:
 *         description: Tenant chưa có phòng đang thuê
 */
router.get("/previous", protect, getPreviousReading);

/**
 * @swagger
 * /meter-readings/scan:
 *   post:
 *     summary: Upload ảnh công tơ, đọc số bằng OCR (chưa lưu DB)
 *     description: >
 *       Bước trung gian — client gọi API này NGAY khi người dùng chụp/chọn ảnh,
 *       nhận về số OCR đọc được để hiển thị lên ô currentReading cho người dùng xem & sửa lại
 *       trước khi gọi POST /meter-readings để lưu thật.
 *     tags: [MeterReadings]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh công tơ (chụp camera hoặc chọn từ thư viện)
 *     responses:
 *       200:
 *         description: Trả về imageUrl + số OCR đọc được (suggestedReading)
 *       400:
 *         description: Vui lòng chọn ảnh công tơ
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
 *     summary: Xác nhận lưu chỉ số điện/nước
 *     description: >
 *       Tháng/năm KHÔNG do client chọn — server tự lấy theo tháng/năm hiện tại lúc gửi.
 *       Chỉ số kỳ trước cũng do server tự tính, không nhận từ client.
 *       Có thể gửi `imageUrl` (lấy từ /meter-readings/scan ở bước trước) hoặc gửi trực tiếp file `image` ở đây.
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
 *                 description: Chỉ số hiện tại (đã xem/sửa lại sau khi OCR ở bước /scan)
 *               unitPrice:
 *                 type: number
 *                 description: Giá/đơn vị (bỏ trống sẽ dùng giá mặc định theo loại)
 *               imageUrl:
 *                 type: string
 *                 description: URL ảnh đã upload từ bước /meter-readings/scan (nếu đã gọi bước đó)
 *               ocrRawText:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: (Tuỳ chọn) Gửi trực tiếp ảnh ở đây nếu KHÔNG gọi /meter-readings/scan trước
 *     responses:
 *       201:
 *         description: Lưu chỉ số thành công
 *       400:
 *         description: Thiếu thông tin / đã gửi chỉ số tháng này rồi / chỉ số không hợp lệ
 *       404:
 *         description: Tenant chưa có phòng đang thuê
 */
router.post(
  "/",
  protect,
  uploadMeterReading.single("image"),
  createMeterReading,
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
 *     responses:
 *       200:
 *         description: Lịch sử chỉ số
 */
router.get("/history", protect, getMeterReadingHistory);

module.exports = router;
