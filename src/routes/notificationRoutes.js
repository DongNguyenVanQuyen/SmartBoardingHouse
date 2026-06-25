//src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { uploadMaintenance } = require("../configs/cloudinary");
const {
  createRequest,
  getRequests,
  getRequestById,
} = require("../controllers/maintenanceController");

/**
 * @swagger
 * tags:
 *   name: Maintenance
 *   description: Yêu cầu sửa chữa
 */

/**
 * @swagger
 * /maintenance-requests:
 *   post:
 *     summary: Tạo yêu cầu sửa chữa
 *     tags: [Maintenance]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               category:
 *                 type: string
 *                 enum: [electrical, plumbing, furniture, other]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Gửi yêu cầu thành công
 *   get:
 *     summary: Danh sách yêu cầu
 *     tags: [Maintenance]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, cancelled]
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu
 */
router.post("/", protect, uploadMaintenance.array("images", 5), createRequest);
router.get("/", protect, getRequests);

/**
 * @swagger
 * /maintenance-requests/{id}:
 *   get:
 *     summary: Chi tiết yêu cầu sửa chữa
 *     tags: [Maintenance]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin yêu cầu
 */
router.get("/:id", protect, getRequestById);

module.exports = router;
