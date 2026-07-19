// src/utils/jwt.js
const jwt = require("jsonwebtoken");

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

// Token do .NET phát hành KHÔNG rút gọn ClaimTypes thành "nameid"/"role" như JWT chuẩn,
// mà giữ nguyên URI đầy đủ của .NET ClaimTypes làm tên field trong payload JSON.
// Ví dụ thực tế lấy từ log debug:
//   "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" -> id user
//   "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"         -> role
const DOTNET_NAMEID_CLAIM =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const DOTNET_ROLE_CLAIM =
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

const normalizeDecoded = (decoded) => ({
  ...decoded,
  id: decoded.id || decoded.nameid || decoded.sub || decoded[DOTNET_NAMEID_CLAIM],
  role: decoded.role || decoded[DOTNET_ROLE_CLAIM],
});

const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return normalizeDecoded(decoded);
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  return normalizeDecoded(decoded);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};