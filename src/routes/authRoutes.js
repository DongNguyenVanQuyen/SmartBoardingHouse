// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const {
  register,
  login,
  refreshToken,
  forgotPassword,
  verifyOtpAndResetPassword,
  changePassword,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middlewares/auth");

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Xác thực người dùng
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký tài khoản
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName: { type: string, example: "Nguyễn Văn A" }
 *               email: { type: string, example: "test@gmail.com" }
 *               phone: { type: string, example: "0901234567" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post("/register", register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "test@gmail.com" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Sai email hoặc mật khẩu
 */
router.post("/login", login);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Làm mới access token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Token mới
 */
router.post("/refresh-token", refreshToken);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Quên mật khẩu - Bước 1 (gửi mã OTP qua email)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: "test@gmail.com" }
 *     responses:
 *       200:
 *         description: Nếu email tồn tại, mã OTP đã được gửi (luôn trả 200 để tránh lộ email tồn tại hay không)
 *       400:
 *         description: Thiếu email
 *       500:
 *         description: Gửi email thất bại
 */
router.post("/forgot-password", forgotPassword);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Quên mật khẩu - Bước 2 (xác thực OTP và đặt mật khẩu mới)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string, example: "test@gmail.com" }
 *               otp: { type: string, example: "123456" }
 *               newPassword: { type: string, example: "newpass123" }
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: OTP không đúng, đã hết hạn, hoặc thiếu thông tin
 *       404:
 *         description: Email không tồn tại
 */
router.post("/verify-otp", verifyOtpAndResetPassword);

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Đổi mật khẩu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 */
router.put("/change-password", protect, changePassword);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post("/logout", protect, logout);

module.exports = router;
