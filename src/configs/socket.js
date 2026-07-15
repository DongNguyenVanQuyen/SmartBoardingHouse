// src/configs/socket.js
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const { verifyAccessToken } = require("../utils/jwt");
const Tenant = require("../models/Tenant");

const conversationRoom = (conversationId) => `conversation_${conversationId}`;

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
      if (!tenant.isActive) return next(new Error("Tài khoản đã bị khóa"));

      // role lấy thẳng từ document DB (tenant.role) — không dùng decoded.role —
      // để nếu admin đổi quyền user này thì áp dụng ngay lần connect tiếp theo,
      // không cần đợi access token cũ hết hạn.
      socket.user = tenant;
      next();
    } catch (err) {
      next(new Error("Token không hợp lệ"));
    }
  });

  // Map lưu userId -> socketId, chỉ dùng để biết online/offline + gửi notification
  const onlineUsers = new Map();
  // Danh sách socketId của các Admin đang online (để broadcast danh sách hội thoại)
  const onlineAdminSockets = new Set();

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    const role = socket.user.role; // "Tenant" | "Admin"

    onlineUsers.set(userId, socket.id);

    // Tenant tự động vào phòng hội thoại của chính mình (conversationId = tenantId).
    // Admin không tự vào phòng nào — client admin phải emit "join_room" với
    // tenantId của cuộc hội thoại đang mở để nhận tin nhắn realtime của tenant đó.
    if (role === "Tenant") {
      socket.join(conversationRoom(userId));
    } else {
      onlineAdminSockets.add(socket.id);
    }

    console.log(
      `[Socket] ${socket.user.fullName} (${role}) connected: ${socket.id}`,
    );

    io.emit("online_users", Array.from(onlineUsers.keys()));

    // Admin dùng để mở 1 cuộc hội thoại cụ thể (conversationId = tenantId đó)
    socket.on("join_room", (conversationId) => {
      if (role !== "Admin") return; // Tenant không cần và không được join phòng khác
      socket.join(conversationRoom(conversationId));
      console.log(
        `[Socket] Admin ${socket.user.fullName} joined room: ${conversationId}`,
      );
    });

    socket.on("leave_room", (conversationId) => {
      if (role !== "Admin") return;
      socket.leave(conversationRoom(conversationId));
    });

    // Gửi tin nhắn — payload khớp với Android SocketManager.sendMessageInternal:
    // { content, type, imageUrl }. Với Admin, cần thêm conversationId (tenantId
    // đang chat) vì 1 admin chat với nhiều tenant khác nhau.
    socket.on("send_message", async (data, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      try {
        const { content, type = "text", imageUrl } = data || {};

        const conversationId = role === "Admin" ? data?.conversationId : userId;

        if (!conversationId) {
          return ack({ success: false, message: "Thiếu conversationId" });
        }
        if (!content) {
          return ack({ success: false, message: "Thiếu nội dung tin nhắn" });
        }

        const message = await Message.create({
          conversationId,
          senderRole: role,
          content,
          type,
          imageUrl: imageUrl || null,
        });

        const room = conversationRoom(conversationId);

        // Gửi cho mọi client đang trong phòng hội thoại này (tenant chủ phòng
        // + admin đang mở đúng hội thoại đó, kể cả chính người gửi).
        io.to(room).emit("new_message", message);

        // Báo cho toàn bộ admin online (kể cả admin chưa mở đúng hội thoại này)
        // để cập nhật badge/danh sách hội thoại ở màn hình getConversations.
        if (role === "Tenant") {
          onlineAdminSockets.forEach((adminSocketId) => {
            io.to(adminSocketId).emit("conversation_updated", {
              conversationId,
              lastMessage: message,
            });
          });
        }

        ack({ success: true, data: message });

        // Tạo notification nếu phía nhận không online trong đúng phòng đó
        const roomSockets = await io.in(room).fetchSockets();
        const receiverIsPresent =
          role === "Tenant"
            ? roomSockets.some((s) => s.user.role === "Admin")
            : roomSockets.some((s) => s.user._id.toString() === conversationId);

        if (!receiverIsPresent) {
          if (role === "Tenant") {
            // Thông báo cho tất cả Admin (không biết admin cụ thể nào sẽ xử lý)
            const admins = await Tenant.find({ role: "Admin" }).select("_id");
            await Notification.insertMany(
              admins.map((admin) => ({
                tenant: admin._id,
                title: "Tin nhắn mới",
                body: `${socket.user.fullName}: ${content.substring(0, 50)}`,
                type: "message",
                refId: message._id,
                refModel: "Message",
              })),
            );
          } else {
            await Notification.create({
              tenant: conversationId,
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

    // Đang nhập — payload khớp Android: { isTyping }. Không có receiverId vì
    // Tenant chỉ có 1 phòng (của chính mình); Admin cần conversationId.
    socket.on("typing", (data) => {
      const conversationId =
        role === "Admin" ? data?.conversationId : userId;
      if (!conversationId) return;

      socket
        .to(conversationRoom(conversationId))
        .emit("typing", { isTyping: !!data?.isTyping, senderRole: role });
    });

    // Đánh dấu đã đọc — Android emit "mark_read" không kèm tham số.
    // Tenant: đánh dấu đã đọc các tin Admin gửi trong phòng của chính mình.
    // Admin: cần truyền conversationId (tenantId) của hội thoại đang xem.
    socket.on("mark_read", async (data) => {
      try {
        const conversationId = role === "Admin" ? data?.conversationId : userId;
        if (!conversationId) return;

        const readerIsTenant = role === "Tenant";
        const filter = {
          conversationId,
          senderRole: readerIsTenant ? "Admin" : "Tenant",
          isRead: false,
        };

        await Message.updateMany(filter, {
          isRead: true,
          readAt: new Date(),
        });

        io.to(conversationRoom(conversationId)).emit("messages_read", {
          conversationId,
          readBy: role,
        });
      } catch (err) {
        console.error("[Socket] mark_read error:", err);
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      onlineAdminSockets.delete(socket.id);
      io.emit("online_users", Array.from(onlineUsers.keys()));
      console.log(`[Socket] ${socket.user.fullName} disconnected`);
    });
  });
};

module.exports = setupSocket;