// src/models/Notification.js
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
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
    refId: { type: mongoose.Schema.Types.ObjectId },
    refModel: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

NotificationSchema.index({ tenant: 1, createdAt: -1 });
NotificationSchema.index({ tenant: 1, isRead: 1 });
NotificationSchema.index({ refId: 1, refModel: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
