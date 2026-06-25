//src/models/MaintenanceRequest.js
const mongoose = require("mongoose");

const maintenanceRequestSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    images: [{ type: String }], // Cloudinary URLs
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    category: {
      type: String,
      enum: ["electrical", "plumbing", "furniture", "other"],
      default: "other",
    },
    resolvedAt: { type: Date },
    adminNote: { type: String }, // Ghi chú từ admin
  },
  { timestamps: true },
);

module.exports = mongoose.model("MaintenanceRequest", maintenanceRequestSchema);
