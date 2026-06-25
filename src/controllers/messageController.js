//src/controllers/messageController.js
const Message = require("../models/Message");
const { success, error: sendError } = require("../utils/response");

// GET /messages
const getConversations = async (req, res) => {
  try {
    // Lấy danh sách cuộc trò chuyện (với admin)
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return success(res, messages, "Lấy tin nhắn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /messages/:userId
const getMessageWithUser = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Đánh dấu đã đọc
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return success(res, messages.reverse(), "Lấy tin nhắn thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getConversations, getMessageWithUser };
