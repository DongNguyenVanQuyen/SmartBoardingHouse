//src/models/MaintenanceRequest.js
const mongoose = require("mongoose");

const maintenanceRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true, trim: true },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    roomNumber: { type: String }, // cache hiển thị cho Admin
    tenantName: { type: String }, // cache hiển thị cho Admin
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
