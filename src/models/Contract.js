//src/models/Contract.js
const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
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
