// src/configs/socket.js
const Message = require("../models/Message");
const { verifyAccessToken } = require("../utils/jwt");
const Tenant = require("../models/Tenant");
const { createAndPushNotification } = require("../services/notificationService");

const conversationRoom = (tenantId) => `conversation_${tenantId}`;

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Không có token"));

      const decoded = verifyAccessToken(token);
      console.log("[DEBUG socket] decoded payload:", decoded); // <-- thêm dòng này

      const tenant = await Tenant.findById(decoded.id).select("-password");
      console.log("[DEBUG socket] tenant found:", tenant); // <-- thêm dòng này

      if (!tenant) return next(new Error("Tenant không tồn tại"));
      if (!tenant.isActive) return next(new Error("Tài khoản đã bị khóa"));

      socket.user = tenant;
      next();
    } catch (err) {
      console.log("[DEBUG socket] lỗi verify:", err.message); // <-- thêm dòng này
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
        const formattedMessage = {
          _id: message._id,
          id: message._id,
          Id: message._id,
          conversationId: message.conversationId,
          ConversationId: message.conversationId,
          senderRole: message.senderRole,
          SenderRole: message.senderRole,
          content: message.content,
          Content: message.content,
          type: message.type,
          Type: message.type,
          imageUrl: message.imageUrl,
          ImageUrl: message.imageUrl,
          isRead: message.isRead,
          IsRead: message.isRead,
          createdAt: message.createdAt,
          CreatedAt: message.createdAt
        };
        io.to(room).emit("new_message", formattedMessage);
        ack({ success: true, data: message });

        // Chỉ tạo Notification khi người NHẬN là Tenant (tức người gửi là Admin).
        // Admin không có document Tenant nên không thể là subject của Notification.
        if (role === "Admin") {
          const tenantOnline = onlineUsers.get(tenantId);
          if (!tenantOnline) {
            await createAndPushNotification({
              tenant: tenantId,
              title: "Tin nhắn mới từ quản lý",
              body: content.substring(0, 50),
              type: "message",
              refId: message._id,
              refModel: "Message",
            });
          }
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