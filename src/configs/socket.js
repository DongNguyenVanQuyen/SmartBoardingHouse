// src/configs/socket.js
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const { verifyAccessToken } = require("../utils/jwt");
const Tenant = require("../models/Tenant");

const conversationRoom = (tenantId) => `conversation_${tenantId}`;

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Không có token"));

      const decoded = verifyAccessToken(token);
      const tenant = await Tenant.findById(decoded.id).select("-password");
      if (!tenant) return next(new Error("Tenant không tồn tại"));
      if (!tenant.isActive) return next(new Error("Tài khoản đã bị khóa"));

      socket.user = tenant;
      next();
    } catch (err) {
      next(new Error("Token không hợp lệ"));
    }
  });

  const onlineUsers = new Map(); // tenantId -> socketId (chỉ áp dụng cho role Tenant)
  let onlineAdminSocketId = null;

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    const role = socket.user.role;

    if (role === "Admin") {
      onlineAdminSocketId = socket.id;
    } else {
      onlineUsers.set(userId, socket.id);
      // Tenant chỉ có đúng 1 conversationId = chính id của họ
      socket.join(conversationRoom(userId));
    }

    console.log(`[Socket] ${socket.user.fullName} (${role}) connected: ${socket.id}`);
    io.emit("online_users", Array.from(onlineUsers.keys()));

    // Admin cần chủ động join/leave phòng của từng Tenant khi mở/đóng khung chat tương ứng
    socket.on("join_room", (tenantId) => {
      if (role !== "Admin" || !tenantId) return;
      socket.join(conversationRoom(tenantId));
    });

    socket.on("leave_room", (tenantId) => {
      if (role !== "Admin" || !tenantId) return;
      socket.leave(conversationRoom(tenantId));
    });

    socket.on("send_message", async (data, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      try {
        const { content, type = "Text", imageUrl } = data || {};
        if (!content) return ack({ success: false, message: "Thiếu nội dung tin nhắn" });

        let tenantId;
        if (role === "Tenant") {
          tenantId = userId;
        } else {
          tenantId = data?.tenantId;
          if (!tenantId) return ack({ success: false, message: "Thiếu tenantId" });
        }

        const message = await Message.create({
          conversationId: tenantId,
          senderRole: role,
          content,
          type,
          imageUrl: imageUrl || null,
        });

        const room = conversationRoom(tenantId);
        io.to(room).emit("new_message", message);
        ack({ success: true, data: message });

        // Xác định người nhận để quyết định có cần tạo Notification hay không
        const receiverSocketId =
          role === "Tenant" ? onlineAdminSocketId : onlineUsers.get(tenantId);

        if (!receiverSocketId) {
          await Notification.create({
            tenant: tenantId,
            title: role === "Tenant" ? "Tin nhắn mới" : "Tin nhắn mới từ quản lý",
            body:
              (role === "Tenant" ? `${socket.user.fullName}: ` : "") +
              content.substring(0, 50),
            type: "message",
            refId: message._id,
            refModel: "Message",
          });
        }
      } catch (err) {
        console.error("[Socket] send_message error:", err);
        ack({ success: false, message: "Không thể gửi tin nhắn" });
      }
    });

    socket.on("typing", (data) => {
      const tenantId = role === "Admin" ? data?.tenantId : userId;
      if (!tenantId) return;

      socket
        .to(conversationRoom(tenantId))
        .emit("typing", { isTyping: !!data?.isTyping, senderRole: role });
    });

    socket.on("mark_read", async (data) => {
      try {
        const tenantId = role === "Admin" ? data?.tenantId : userId;
        if (!tenantId) return;

        const readerIsTenant = role === "Tenant";

        await Message.updateMany(
          {
            conversationId: tenantId,
            senderRole: readerIsTenant ? "Admin" : "Tenant",
            isRead: false,
          },
          { isRead: true, readAt: new Date() },
        );

        io.to(conversationRoom(tenantId)).emit("messages_read", {
          conversationId: tenantId,
          readBy: role,
        });
      } catch (err) {
        console.error("[Socket] mark_read error:", err);
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      if (role === "Admin" && onlineAdminSocketId === socket.id) {
        onlineAdminSocketId = null;
      }
      io.emit("online_users", Array.from(onlineUsers.keys()));
      console.log(`[Socket] ${socket.user.fullName} disconnected`);
    });
  });
};

module.exports = setupSocket;