// src/controllers/authController.js
const crypto = require("crypto");
const Tenant = require("../models/Tenant");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const { success, error: sendError } = require("../utils/response");
const { sendOtpEmail } = require("../configs/mailer");

const OTP_EXPIRY_MINUTES = 5;

// POST /auth/register
const register = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !password) {
      return sendError(res, "Vui lòng điền đầy đủ thông tin", 400);
    }

    const existing = await Tenant.findOne({ email });
    if (existing) return sendError(res, "Email đã được sử dụng", 400);

    // Không nhận role từ req.body để tránh client tự phong Admin cho mình —
    // đăng ký công khai luôn tạo role mặc định "Tenant" (schema đã default sẵn).
    const tenant = await Tenant.create({ fullName, email, phone, password });

    const accessToken = generateAccessToken(tenant._id, tenant.role);
    const refreshToken = generateRefreshToken(tenant._id, tenant.role);

    tenant.refreshToken = refreshToken;
    await tenant.save();

    return success(
      res,
      { tenant, accessToken, refreshToken },
      "Đăng ký thành công",
      201,
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, "Vui lòng nhập email và mật khẩu", 400);
    }

    const tenant = await Tenant.findOne({ email }).select("+password");
    if (!tenant) return sendError(res, "Email hoặc mật khẩu không đúng", 401);

    const isMatch = await tenant.comparePassword(password);
    if (!isMatch) return sendError(res, "Email hoặc mật khẩu không đúng", 401);

    if (tenant.role === "Admin") {
      return sendError(res, "Tài khoản Admin không được đăng nhập ứng dụng này", 403);
    }

    if (!tenant.isActive) return sendError(res, "Tài khoản đã bị khóa", 403);

    // Ký role thật lấy từ DB, không mặc định "Tenant" nữa
    const accessToken = generateAccessToken(tenant._id, tenant.role);
    const refreshToken = generateRefreshToken(tenant._id, tenant.role);

    tenant.refreshToken = refreshToken;
    await tenant.save();

    return success(
      res,
      { tenant, accessToken, refreshToken },
      "Đăng nhập thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /auth/refresh-token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return sendError(res, "Không có refresh token", 400);

    const decoded = verifyRefreshToken(token);
    const tenant = await Tenant.findById(decoded.id);

    if (!tenant || tenant.refreshToken !== token) {
      return sendError(res, "Refresh token không hợp lệ", 401);
    }

    // Lấy role hiện tại từ DB (không dùng decoded.role) — phòng trường hợp
    // admin đổi quyền tenant này sau khi refresh token cũ đã được cấp.
    const accessToken = generateAccessToken(tenant._id, tenant.role);
    const newRefreshToken = generateRefreshToken(tenant._id, tenant.role);

    tenant.refreshToken = newRefreshToken;
    await tenant.save();

    return success(
      res,
      { accessToken, refreshToken: newRefreshToken },
      "Làm mới token thành công",
    );
  } catch (err) {
    return sendError(res, "Refresh token không hợp lệ hoặc đã hết hạn", 401);
  }
};

// POST /auth/forgot-password — Bước 1: gửi OTP qua email
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, "Vui lòng nhập email", 400);

    const tenant = await Tenant.findOne({ email });
    // Không tiết lộ email có tồn tại hay không (bảo mật) — luôn trả về thành công
    if (!tenant) {
      return success(res, null, "Nếu email tồn tại, mã OTP đã được gửi");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    tenant.resetOtp = otp;
    tenant.resetOtpExpiry = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );
    await tenant.save();

    try {
      await sendOtpEmail(tenant.email, otp);
    } catch (mailErr) {
      console.error("===== MAIL ERROR =====");
      console.error(mailErr);
      console.error("code:", mailErr.code);
      console.error("response:", mailErr.response);
      console.error("responseCode:", mailErr.responseCode);
      console.error("======================");

      return sendError(res, "Không gửi được email, vui lòng thử lại sau", 500);
    }

    return success(res, null, "Nếu email tồn tại, mã OTP đã được gửi");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /auth/verify-otp — Bước 2: xác thực OTP + đặt mật khẩu mới
const verifyOtpAndResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return sendError(
        res,
        "Vui lòng nhập đầy đủ email, OTP và mật khẩu mới",
        400,
      );
    }

    if (newPassword.length < 6) {
      return sendError(res, "Mật khẩu mới phải ít nhất 6 ký tự", 400);
    }

    const tenant = await Tenant.findOne({ email }).select(
      "+resetOtp +resetOtpExpiry +password",
    );

    if (!tenant) return sendError(res, "Email không tồn tại", 404);

    if (!tenant.resetOtp || !tenant.resetOtpExpiry) {
      return sendError(res, "Vui lòng yêu cầu mã OTP trước", 400);
    }

    if (tenant.resetOtpExpiry < new Date()) {
      return sendError(res, "Mã OTP đã hết hạn, vui lòng yêu cầu lại", 400);
    }

    if (tenant.resetOtp !== otp) {
      return sendError(res, "Mã OTP không đúng", 400);
    }

    tenant.password = newPassword;
    tenant.resetOtp = null;
    tenant.resetOtpExpiry = null;
    tenant.refreshToken = null; // buộc đăng nhập lại trên mọi thiết bị
    await tenant.save();

    return success(res, null, "Đặt lại mật khẩu thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(res, "Vui lòng nhập đầy đủ thông tin", 400);
    }

    const tenant = await Tenant.findById(req.user._id).select("+password");
    const isMatch = await tenant.comparePassword(currentPassword);
    if (!isMatch) return sendError(res, "Mật khẩu hiện tại không đúng", 400);

    if (newPassword.length < 6) {
      return sendError(res, "Mật khẩu mới phải ít nhất 6 ký tự", 400);
    }

    tenant.password = newPassword;
    await tenant.save();

    return success(res, null, "Đổi mật khẩu thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /auth/logout
const logout = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user._id);
    tenant.refreshToken = null;
    tenant.fcmToken = null;
    await tenant.save();

    return success(res, null, "Đăng xuất thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  forgotPassword,
  verifyOtpAndResetPassword,
  changePassword,
  logout,
};
