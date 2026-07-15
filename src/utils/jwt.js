//src/utils/jwt.js
const jwt = require("jsonwebtoken");

// Ký access token, luôn kèm role ("Tenant" | "Admin") để middleware xác thực
// (REST lẫn Socket) biết được ai đang gọi mà không cần query lại DB.
const generateAccessToken = (tenantId, role = "Tenant") => {
  return jwt.sign({ id: tenantId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

const generateRefreshToken = (tenantId, role = "Tenant") => {
  return jwt.sign({ id: tenantId, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
