//src/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["invoice", "debt", "maintenance", "message", "general"],
      default: "general",
    },
    refId: { type: mongoose.Schema.Types.ObjectId }, // ID của invoice/maintenance...
    refModel: { type: String }, // "Invoice", "MaintenanceRequest"...
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
