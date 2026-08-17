// src/routes/profileRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");

// 🟢 SỬA: Đã thêm uploadIdCard vào đây
const { uploadAvatar, uploadIdCard } = require("../configs/cloudinary");

const {
  getProfile,
  updateProfile,
  updateAvatar,
  uploadIdentityCard
} = require("../controllers/profileController");

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Hồ sơ cá nhân
 */

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Xem thông tin cá nhân
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Thông tin tenant
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Profile]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string }
 *               idCard: { type: string }
 *               address: { type: string }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.get("/", protect, getProfile);
router.put("/", protect, updateProfile);

/**
 * @swagger
 * /profile/avatar:
 *   post:
 *     summary: Cập nhật avatar
 *     tags: [Profile]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar cập nhật thành công
 */
router.post("/avatar", protect, uploadAvatar.single("avatar"), updateAvatar);

/**
 * @swagger
 * /profile/identity-card:
 *   post:
 *     summary: Cập nhật ảnh CMND/CCCD
 *     tags: [Profile]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               frontImage:
 *                 type: string
 *                 format: binary
 *               backImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Ảnh CMND/CCCD cập nhật thành công
 */
// 🟢 THÊM MỚI: Route xử lý upload ảnh CMND 2 mặt
router.post(
  "/identity-card",
  protect,
  uploadIdCard.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 }
  ]),
  uploadIdentityCard
);

module.exports = router;