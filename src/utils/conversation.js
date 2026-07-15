// src/utils/conversation.js
const Tenant = require("../models/Tenant");

let cachedAdminId = null;

const getAdminId = async () => {
  if (cachedAdminId) return cachedAdminId;
  const admin = await Tenant.findOne({ role: "Admin" }).select("_id");
  if (admin) cachedAdminId = admin._id.toString();
  return cachedAdminId;
};

const buildConversationId = (adminId, tenantId) =>
  `${adminId.toString()}_${tenantId.toString()}`;

module.exports = { getAdminId, buildConversationId };