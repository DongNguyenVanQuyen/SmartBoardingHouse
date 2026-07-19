// src/utils/jwt.js
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

// Đăng nhập (Admin lẫn Tenant) hiện được xử lý HOÀN TOÀN bên .NET (AuthController),
// không phải Node. Token do .NET phát hành có claim dạng ClaimTypes.NameIdentifier /
// ClaimTypes.Role, và JwtSecurityTokenHandler bên .NET tự động đổi tên các claim này
// thành "nameid" / "role" khi ghi vào JWT (không phải "id"/"sub"). Nên ở đây cần chuẩn
// hoá lại decoded payload để phần còn lại của code Node (protect, socket.js) vẫn dùng
// decoded.id / decoded.role như cũ, bất kể token đến từ .NET hay (trước đây) từ chính Node.
const normalizeDecoded = (decoded) => ({
  ...decoded,
  id: decoded.id || decoded.nameid || decoded.sub,
  role: decoded.role || decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
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