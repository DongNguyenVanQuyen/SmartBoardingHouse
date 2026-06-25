//src/controllers/authController.js
const Tenant = require("../models/Tenant");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const { success, error: sendError } = require("../utils/response");

// POST /auth/register
const register = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !password) {
      return sendError(res, "Vui lòng điền đầy đ�?thông tin", 400);
    }

    const existing = await Tenant.findOne({ email });
    if (existing) return sendError(res, "Email đã được s�?dụng", 400);

    const tenant = await Tenant.create({ fullName, email, phone, password });

    const accessToken = generateAccessToken(tenant._id);
    const refreshToken = generateRefreshToken(tenant._id);

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

    if (!tenant.isActive) return sendError(res, "Tài khoản đã b�?khóa", 403);

    const accessToken = generateAccessToken(tenant._id);
    const refreshToken = generateRefreshToken(tenant._id);

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
      return sendError(res, "Refresh token không hợp lê", 401);
    }

    const accessToken = generateAccessToken(tenant._id);
    const newRefreshToken = generateRefreshToken(tenant._id);

    tenant.refreshToken = newRefreshToken;
    await tenant.save();

    return success(
      res,
      { accessToken, refreshToken: newRefreshToken },
      "Làm mới token thành công",
    );
  } catch (err) {
    return sendError(res, "Refresh token không hợp l�?hoặc đã hết hạn", 401);
  }
};

// POST /auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    // Thực t�? gửi email OTP. Hiện tại: reset trực tiếp (cần tích hợp email service)
    if (!email || !newPassword) {
      return sendError(res, "Vui lòng nhập email và mật khẩu mới", 400);
    }

    const tenant = await Tenant.findOne({ email });
    if (!tenant) return sendError(res, "Email không tồn tại", 404);

    tenant.password = newPassword;
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
  changePassword,
  logout,
};
