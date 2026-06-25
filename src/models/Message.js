//src/models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    receiver: { type: mongoose.Schema.Types.ObjectId, required: true }, // tenant hoặc admin
    senderModel: { type: String, enum: ["Tenant", "Admin"], default: "Tenant" },
    content: { type: String, required: true },
    type: { type: String, enum: ["text", "image"], default: "text" },
    imageUrl: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);
