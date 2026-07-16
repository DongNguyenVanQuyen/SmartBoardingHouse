const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    // Bằng đúng _id của Tenant tham gia cuộc trò chuyện (khớp với bên Admin C#).
    // Vì hệ thống chỉ có 1 Admin (hardcoded), 1 cuộc hội thoại = 1 Tenant,
    // nên không cần ghép thêm adminId vào conversationId nữa.
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["Admin", "Tenant"],
      required: true,
    },
    content: { type: String, required: true },
    type: { type: String, enum: ["Text", "Image"], default: "Text" },
    imageUrl: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", MessageSchema);