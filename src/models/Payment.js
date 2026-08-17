const mongoose = require("mongoose");
const crypto = require("crypto");

const PaymentSchema = new mongoose.Schema(
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
    payToken: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(16).toString("hex"),
    },
    transactionId: { type: String },
    qrData: { type: String },
    paidAt: { type: Date },
    note: { type: String },
    receiptImage: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Payment", PaymentSchema);
