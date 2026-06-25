//src/configs/socket.js
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const { verifyAccessToken } = require("../utils/jwt");
const Tenant = require("../models/Tenant");

const setupSocket = (io) => {
  // Middleware xác thực socket
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Không có token"));

      const decoded = verifyAccessToken(token);
      const tenant = await Tenant.findById(decoded.id).select("-password");
      if (!tenant) return next(new Error("Tenant không tồn tại"));

      socket.user = tenant;
      next();
    } catch (err) {
      next(new Error("Token không hợp lệ"));
    }
  });

  // Map lưu userId → socketId
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    onlineUsers.set(userId, socket.id);

    console.log(
      `[Socket] User ${socket.user.fullName} connected: ${socket.id}`,
    );

    // Emit danh sách online users
    io.emit("online_users", Array.from(onlineUsers.keys()));

    // Tham gia phòng chat riêng
    socket.on("join_room", (roomId) => {
      socket.join(roomId);
      console.log(`[Socket] ${socket.user.fullName} joined room: ${roomId}`);
    });

    // Gửi tin nhắn
    socket.on("send_message", async (data) => {
      try {
        const { receiverId, content, type = "text" } = data;

        if (!receiverId || !content) return;

        // Lưu DB
        const message = await Message.create({
          sender: socket.user._id,
          receiver: receiverId,
          content,
          type,
        });

        const populatedMsg = await Message.findById(message._id).populate(
          "sender",
          "fullName avatar",
        );

        // Gửi tới receiver nếu online
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", populatedMsg);
        }

        // Phản hồi lại sender
        socket.emit("receive_message", populatedMsg);

        // Tạo notification nếu receiver offline
        if (!receiverSocketId) {
          await Notification.create({
            tenant: receiverId,
            title: "Tin nhắn mới",
            body: `${socket.user.fullName}: ${content.substring(0, 50)}`,
            type: "message",
            refId: message._id,
            refModel: "Message",
          });
        }
      } catch (err) {
        socket.emit("error", { message: "Không thể gửi tin nhắn" });
      }
    });

    // Đang nhập
    socket.on("typing", ({ receiverId, isTyping }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", {
          senderId: userId,
          isTyping,
        });
      }
    });

    // Đọc tin nhắn
    socket.on("read_messages", async ({ senderId }) => {
      await Message.updateMany(
        { sender: senderId, receiver: socket.user._id, isRead: false },
        { isRead: true, readAt: new Date() },
      );
    });

    // Ngắt kết nối
    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));
      console.log(`[Socket] User ${socket.user.fullName} disconnected`);
    });
  });
};

module.exports = setupSocket;
