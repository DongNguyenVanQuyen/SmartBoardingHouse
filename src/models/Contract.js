//src/models/Contract.js
const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
  {
    contractNumber: { type: String, required: true, unique: true, trim: true },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    // Cache hiển thị cho Admin, đồng bộ khi tenant/room đổi
    tenantName: { type: String },
    roomNumber: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    paymentDate: { type: Number, min: 1, max: 31, default: 1 }, // Ngày thu tiền hàng tháng
    deposit: { type: Number, required: true }, // Tiền cọc
    monthlyRent: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "expired", "terminated"],
      default: "active",
    },
    terms: { type: String }, // Điều khoản hợp đồng
    signedDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Contract", contractSchema);
