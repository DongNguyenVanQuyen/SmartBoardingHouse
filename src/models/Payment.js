//src/models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["qr", "cash", "transfer"],
      default: "qr",
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    transactionId: { type: String }, // Mã giao dịch từ ngân hàng
    qrData: { type: String }, // Nội dung QR code
    paidAt: { type: Date },
    note: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payment", paymentSchema);
