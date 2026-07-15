// src/sockets/chatSocket.js
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const Tenant = require("../models/Tenant");

// Map lưu trạng thái online: key = conversationId (tenantId) hoặc "admin", value = socket.id
const onlineUsers = new Map();
const ADMIN_ROOM = "admin_room";

const initChatSocket = (io) => {
  // Middleware xác thực JWT khi client connect
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Không có token xác thực"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // decoded phải chứa role: "Tenant" | "Admin"
      // Với admin: decoded từ .env credentials, không có _id thật trong DB
      socket.user = {
        role: decoded.role,
        _id: decoded.role === "Tenant" ? decoded._id : null,
      };

      next();
    } catch (err) {
      next(new Error("Token không hợp lệ"));
    }
  });

  io.on("connection", (socket) => {
    const { role, _id } = socket.user;

    if (role === "Tenant") {
      const conversationId = _id.toString();
      onlineUsers.set(conversationId, socket.id);
      socket.join(conversationId); // tenant join room riêng của mình
      io.to(ADMIN_ROOM).emit("tenant_online", { conversationId });

      console.log(`Tenant ${conversationId} đã kết nối`);
    } else if (role === "Admin") {
      onlineUsers.set("admin", socket.id);
      socket.join(ADMIN_ROOM); // admin join room chung để nhận thông báo từ mọi tenant

      console.log("Admin đã kết nối");
    }

    // Gửi tin nhắn
    socket.on("send_message", async (data, callback) => {
      try {
        const {
          content,
          type = "text",
          imageUrl,
          conversationId: targetConversationId,
        } = data;

        // Tin nhắn dạng "image" bắt buộc phải có imageUrl (đã upload lên Cloudinary trước đó
        // qua REST endpoint POST /messages/upload-image). Tin nhắn "text" bắt buộc có content.
        if (type === "image") {
          if (!imageUrl) {
            return callback?.({
              success: false,
              message: "Thiếu imageUrl cho tin nhắn ảnh",
            });
          }
        } else if (!content) {
          return callback?.({
            success: false,
            message: "Nội dung tin nhắn không được để trống",
          });
        }

        let conversationId;

        if (role === "Tenant") {
          // Tenant luôn gửi cho admin -> conversationId = chính tenant đó
          conversationId = _id.toString();
        } else if (role === "Admin") {
          // Admin phải chỉ định đang trả lời cho tenant nào
          if (!targetConversationId) {
            return callback?.({
              success: false,
              message: "Thiếu conversationId (tenant nhận tin nhắn)",
            });
          }
          conversationId = targetConversationId;
        }

        const message = await Message.create({
          conversationId,
          senderRole: role,
          content: content || (type === "image" ? "[Hình ảnh]" : ""),
          type,
          imageUrl,
        });

        // Gửi tin nhắn tới tenant (room riêng theo conversationId)
        io.to(conversationId).emit("new_message", message);

        // Gửi tin nhắn tới admin (room chung), kèm conversationId để admin biết của tenant nào
        io.to(ADMIN_ROOM).emit("new_message", message);

        // Cho phép admin refresh danh sách hội thoại (last message / unread count)
        // mà không cần gọi lại toàn bộ getConversations sau mỗi tin nhắn.
        io.to(ADMIN_ROOM).emit("conversation_updated", {
          conversationId,
          lastMessage: message,
        });

        callback?.({ success: true, data: message });
      } catch (err) {
        console.error("send_message error:", err.message);
        callback?.({ success: false, message: err.message });
      }
    });

    // Đánh dấu đã đọc
    socket.on("mark_read", async (data) => {
      try {
        const { conversationId: targetConversationId } = data || {};
        const conversationId =
          role === "Tenant" ? _id.toString() : targetConversationId;

        if (!conversationId) return;

        // Nếu tenant đọc -> đánh dấu các tin của admin gửi tới là đã đọc
        // Nếu admin đọc -> đánh dấu các tin của tenant gửi tới là đã đọc
        const readSenderRole = role === "Tenant" ? "Admin" : "Tenant";

        await Message.updateMany(
          { conversationId, senderRole: readSenderRole, isRead: false },
          { isRead: true, readAt: new Date() },
        );

        io.to(conversationId).emit("messages_read", { conversationId });
        io.to(ADMIN_ROOM).emit("messages_read", { conversationId });
      } catch (err) {
        console.error("mark_read error:", err.message);
      }
    });

    // Typing indicator (optional nhưng hữu ích cho chat UI)
    socket.on("typing", (data) => {
      const conversationId =
        role === "Tenant" ? _id.toString() : data?.conversationId;
      if (!conversationId) return;

      if (role === "Tenant") {
        io.to(ADMIN_ROOM).emit("typing", { conversationId, role });
      } else {
        io.to(conversationId).emit("typing", { conversationId, role });
      }
    });

    socket.on("disconnect", () => {
      if (role === "Tenant") {
        onlineUsers.delete(_id.toString());
        io.to(ADMIN_ROOM).emit("tenant_offline", {
          conversationId: _id.toString(),
        });
        console.log(`Tenant ${_id} đã ngắt kết nối`);
      } else if (role === "Admin") {
        onlineUsers.delete("admin");
        console.log("Admin đã ngắt kết nối");
      }
    });
  });
};

// Helper kiểm tra online (dùng ở nơi khác nếu cần, ví dụ notificationService)
const isOnline = (conversationId) => onlineUsers.has(conversationId);
const isAdminOnline = () => onlineUsers.has("admin");

module.exports = { initChatSocket, isOnline, isAdminOnline };
