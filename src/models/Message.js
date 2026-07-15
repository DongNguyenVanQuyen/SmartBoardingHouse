const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    // Luôn có dạng `${adminId}_${tenantId}` — cố định vị trí adminId trước,
    // bất kể ai là người gửi, để 1 cuộc hội thoại (Admin <-> 1 Tenant) luôn
    // ứng với đúng 1 conversationId duy nhất.
    conversationId: {
      type: String,
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    content: { type: String, required: true },
    type: { type: String, enum: ["text", "image"], default: "text" },
    imageUrl: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", MessageSchema);