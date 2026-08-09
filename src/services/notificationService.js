// src/services/notificationService.js
const { messaging } = require("../configs/firebase");
const Notification = require("../models/Notification");
const Tenant = require("../models/Tenant");

// Gửi push FCM tới 1 tenant (nếu có fcmToken và Firebase đã khởi tạo thành công)
const sendPushToTenant = async (tenant, title, body, data = {}) => {
  if (!tenant || !tenant.fcmToken || !messaging) return;

  try {
    await messaging.send({
      token: tenant.fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ),
    });
  } catch (err) {
    console.error(`Gửi FCM thất bại cho tenant ${tenant._id}:`, err.message);
  }
};

/**
 * Tạo Notification trong DB VÀ gửi push FCM cùng lúc.
 * Dùng hàm này thay cho Notification.create(...) ở mọi nơi cần báo tenant,
 * để tenant luôn nhận được cả lịch sử trong app lẫn thông báo đẩy trên điện thoại.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.tenant - id của tenant (bắt buộc)
 * @param {string} params.title
 * @param {string} params.body
 * @param {string} params.type - "invoice" | "debt" | "maintenance" | "message" | "general"
 * @param {string|ObjectId} [params.refId]
 * @param {string} [params.refModel]
 * @param {Object} [params.meta]
 * @param {Object} [params.tenantDoc] - truyền sẵn document Tenant (có fcmToken) nếu đã có,
 *                                      để tránh phải query lại DB.
 */
const createAndPushNotification = async ({
  tenant,
  title,
  body,
  type = "general",
  refId,
  refModel,
  meta,
  tenantDoc,
}) => {
  const notification = await Notification.create({
    tenant,
    title,
    body,
    type,
    refId,
    refModel,
    meta,
  });

  const tenantForPush =
    tenantDoc || (await Tenant.findById(tenant).select("fcmToken"));

  await sendPushToTenant(tenantForPush, title, body, {
    type,
    refId: refId ? refId.toString() : undefined,
  });

  return notification;
};

module.exports = { createAndPushNotification, sendPushToTenant };