//src/middlewares/auth.js
const { verifyAccessToken } = require("../utils/jwt");
const Tenant = require("../models/Tenant");
const { error } = require("../utils/response");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return error(res, "Không có token xác thực", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const tenant = await Tenant.findById(decoded.id).select(
      "-password -refreshToken",
    );
    if (!tenant || !tenant.isActive) {
      return error(res, "Tài khoản không tồn tại hoặc đã bị khóa", 401);
    }

    req.user = tenant;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return error(res, "Token đã hết hạn", 401);
    }
    return error(res, "Token không hợp lệ", 401);
  }
};

module.exports = { protect };
