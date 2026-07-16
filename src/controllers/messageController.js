const Message = require("../models/Message");
const { success, error: sendError } = require("../utils/response");

// GET /messages — ADMIN: danh sách tất cả cuộc trò chuyện
const getConversations = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return sendError(res, "Chỉ admin mới được xem danh sách hội thoại", 403);
    }

    const conversations = await Message.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isRead", false] },
                    { $eq: ["$senderRole", "Tenant"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
      {
        $lookup: {
          from: "tenants",
          localField: "_id",
          foreignField: "_id",
          as: "tenant",
        },
      },
      { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          conversationId: "$_id",
          tenant: { _id: 1, fullName: 1, phone: 1, avatar: 1 },
          lastMessage: 1,
          unreadCount: 1,
        },
      },
    ]);

    return success(res, conversations, "Lấy danh sách hội thoại thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /messages/me — TENANT: lịch sử chat của chính mình với Admin
const getMyMessages = async (req, res) => {
  try {
    if (req.user.role !== "Tenant") {
      return sendError(res, "Chỉ tenant mới dùng được API này", 403);
    }

    const conversationId = req.user._id;
    const { page = 1, limit = 30 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    await Message.updateMany(
      { conversationId, senderRole: "Admin", isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return success(res, messages.reverse(), "Lấy tin nhắn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /messages/:tenantId — ADMIN: lịch sử chat với 1 tenant cụ thể
const getMessagesWithTenant = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return sendError(res, "Chỉ admin mới dùng được API này", 403);
    }

    const { tenantId } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    const messages = await Message.find({ conversationId: tenantId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    await Message.updateMany(
      { conversationId: tenantId, senderRole: "Tenant", isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return success(res, messages.reverse(), "Lấy tin nhắn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /messages/upload-image — không đổi
const uploadChatImage = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, "Không có file ảnh nào được gửi lên", 400);
    }
    return success(
      res,
      { imageUrl: req.file.path, publicId: req.file.filename },
      "Tải ảnh lên thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  getConversations,
  getMyMessages,
  getMessagesWithTenant,
  uploadChatImage,
};