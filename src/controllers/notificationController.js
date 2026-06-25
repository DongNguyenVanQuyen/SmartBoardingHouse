//src/controllers/notificationController.js
const Notification = require("../models/Notification");
const Tenant = require("../models/Tenant");
const { success, error: sendError } = require("../utils/response");

// GET /notifications
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const skip = (page - 1) * limit;
    const filter = { tenant: req.user._id };
    if (isRead !== undefined) filter.isRead = isRead === "true";

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ tenant: req.user._id, isRead: false }),
    ]);

    return success(
      res,
      {
        notifications,
        unreadCount,
        pagination: { page: parseInt(page), limit: parseInt(limit), total },
      },
      "Lấy thông báo thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /notifications/read
const markAsRead = async (req, res) => {
  try {
    const { notificationIds, all } = req.body;

    if (all) {
      await Notification.updateMany(
        { tenant: req.user._id, isRead: false },
        { isRead: true, readAt: new Date() },
      );
      return success(res, null, "Đã đọc tất c�?thông báo");
    }

    if (!notificationIds || !notificationIds.length) {
      return sendError(res, "Vui lòng chọn thông báo", 400);
    }

    await Notification.updateMany(
      { _id: { $in: notificationIds }, tenant: req.user._id },
      { isRead: true, readAt: new Date() },
    );

    return success(res, null, "Đã đọc thông báo");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// Cập nhật FCM Token
const updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return sendError(res, "Thiếu FCM token", 400);

    await Tenant.findByIdAndUpdate(req.user._id, { fcmToken });
    return success(res, null, "Cập nhật FCM token thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getNotifications, markAsRead, updateFCMToken };

