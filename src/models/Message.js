const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true, // luôn là tenantId, vì chỉ có 1 admin
    },
    senderRole: {
      type: String,
      enum: ["Tenant", "Admin"],
      required: true, // ai là người gửi
    },
    content: { type: String, required: true },
    type: { type: String, enum: ["text", "image"], default: "text" },
    imageUrl: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
