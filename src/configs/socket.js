const Message = require("../models/Message");
const Notification = require("../models/Notification");
const { verifyAccessToken } = require("../utils/jwt");
const Tenant = require("../models/Tenant");
const { getAdminId, buildConversationId } = require("../utils/conversation");

const conversationRoom = (conversationId) => `conversation_${conversationId}`;

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

      socket.user = tenant; // role lấy trực tiếp từ DB (tenant.role)
      next();
    } catch (err) {
      next(new Error("Token không hợp lệ"));
    }
  });

  const onlineUsers = new Map(); // userId -> socketId (Tenant lẫn Admin)
  let onlineAdminSocketId = null; // vì chỉ có 1 Admin duy nhất

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    const role = socket.user.role;

    onlineUsers.set(userId, socket.id);

    if (role === "Admin") {
      onlineAdminSocketId = socket.id;
    } else {
      // Tenant tự động join phòng hội thoại của chính mình với Admin
      const adminId = await getAdminId();
      if (adminId) {
        socket.join(conversationRoom(buildConversationId(adminId, userId)));
      }
    }

    console.log(`[Socket] ${socket.user.fullName} (${role}) connected: ${socket.id}`);
    io.emit("online_users", Array.from(onlineUsers.keys()));

    // Admin dùng để mở 1 hội thoại cụ thể — client Admin phải emit kèm tenantId
    socket.on("join_room", async (tenantId) => {
      if (role !== "Admin" || !tenantId) return;
      const adminId = await getAdminId();
      socket.join(conversationRoom(buildConversationId(adminId, tenantId)));
    });

    socket.on("leave_room", async (tenantId) => {
      if (role !== "Admin" || !tenantId) return;
      const adminId = await getAdminId();
      socket.leave(conversationRoom(buildConversationId(adminId, tenantId)));
    });

    // Gửi tin nhắn — payload khớp Android SocketManager: { content, type, imageUrl }.
    // Tenant KHÔNG cần truyền receiverId (chỉ có 1 Admin, server tự resolve).
    // Admin CẦN truyền thêm "tenantId" (đang chat với tenant nào).
    socket.on("send_message", async (data, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      try {
        const { content, type = "text", imageUrl } = data || {};
        if (!content) return ack({ success: false, message: "Thiếu nội dung tin nhắn" });

        const adminId = await getAdminId();
        if (!adminId) return ack({ success: false, message: "Hệ thống chưa có Admin" });

        let senderId, receiverId, tenantId;
        if (role === "Tenant") {
          senderId = userId;
          receiverId = adminId;
          tenantId = userId;
        } else {
          tenantId = data?.tenantId;
          if (!tenantId) return ack({ success: false, message: "Thiếu tenantId" });
          senderId = adminId;
          receiverId = tenantId;
        }

        const conversationId = buildConversationId(adminId, tenantId);

        const message = await Message.create({
          conversationId,
          sender: senderId,
          receiver: receiverId,
          content,
          type,
          imageUrl: imageUrl || null,
        });

        const room = conversationRoom(conversationId);
        io.to(room).emit("new_message", message);
        ack({ success: true, data: message });

        // Notification nếu phía nhận offline
        const receiverSocketId =
          receiverId === adminId ? onlineAdminSocketId : onlineUsers.get(receiverId);

        if (!receiverSocketId) {
          await Notification.create({
            tenant: role === "Tenant" ? adminId : tenantId,
            // Lưu ý: model Notification hiện tại chỉ có field "tenant" (1 người nhận cụ thể).
            // Nếu Admin cần nhận notification giống Tenant, Notification model cần thêm
            // trường phân biệt đối tượng nhận (vd: recipientRole) — hiện đang gán tạm
            // "tenant: adminId" khi Tenant gửi, cần đối chiếu lại nếu Notification chỉ nên
            // dành cho Tenant.
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

    socket.on("typing", async (data) => {
      const adminId = await getAdminId();
      if (!adminId) return;
      const tenantId = role === "Admin" ? data?.tenantId : userId;
      if (!tenantId) return;

      const conversationId = buildConversationId(adminId, tenantId);
      socket
        .to(conversationRoom(conversationId))
        .emit("typing", { isTyping: !!data?.isTyping, senderRole: role });
    });

    // Android emit "mark_read" không kèm tham số (Tenant tự biết phòng của mình).
    // Admin cần truyền { tenantId } để biết đang đọc hội thoại nào.
    socket.on("mark_read", async (data) => {
      try {
        const adminId = await getAdminId();
        if (!adminId) return;
        const tenantId = role === "Admin" ? data?.tenantId : userId;
        if (!tenantId) return;

        const conversationId = buildConversationId(adminId, tenantId);
        const readerIsTenant = role === "Tenant";

        await Message.updateMany(
          {
            conversationId,
            sender: readerIsTenant ? adminId : tenantId,
            isRead: false,
          },
          { isRead: true, readAt: new Date() },
        );

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
      if (role === "Admin" && onlineAdminSocketId === socket.id) {
        onlineAdminSocketId = null;
      }
      io.emit("online_users", Array.from(onlineUsers.keys()));
      console.log(`[Socket] ${socket.user.fullName} disconnected`);
    });
  });
};

module.exports = setupSocket;