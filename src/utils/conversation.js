// src/utils/conversation.js
// Vì hệ thống chỉ có đúng 1 Admin, mọi nơi cần biết "adminId" và cần build
// conversationId đều đi qua đây để đảm bảo đồng nhất công thức.
const Tenant = require("../models/Tenant");

let cachedAdminId = null;

// Cache adminId trong memory (chỉ query DB 1 lần cho tới khi restart server).
// Nếu bạn có nhu cầu đổi Admin, restart server để cache được nạp lại.
const getAdminId = async () => {
  if (cachedAdminId) return cachedAdminId;
  const admin = await Tenant.findOne({ role: "Admin" }).select("_id");
  if (admin) cachedAdminId = admin._id.toString();
  return cachedAdminId;
};

const buildConversationId = (adminId, tenantId) =>
  `${adminId.toString()}_${tenantId.toString()}`;

module.exports = { getAdminId, buildConversationId };