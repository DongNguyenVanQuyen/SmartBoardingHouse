//src/models/Invoice.js
const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    contract: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
    // Cache hiển thị cho Admin
    tenantName: { type: String },
    roomNumber: { type: String },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    dueDate: { type: Date, required: true },

    // Các khoản phí cố định hàng tháng (khớp Admin)
    roomPrice: { type: Number, default: 0 },
    electricUsage: { type: Number, default: 0 },
    electricPrice: { type: Number, default: 0 },
    waterUsage: { type: Number, default: 0 },
    waterPrice: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },

    // Phụ phí phát sinh khác (giữ tính linh hoạt cũ của Client)
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, required: true },
        total: { type: Number, required: true },
      },
    ],

    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "overdue"],
      default: "unpaid",
    },
    note: { type: String },
  },
  { timestamps: true },
);

// Tự tính totalAmount = roomPrice + điện + nước + dịch vụ + tổng items phụ
invoiceSchema.pre("save", function () {
  const electricTotal = (this.electricUsage || 0) * (this.electricPrice || 0);
  const waterTotal = (this.waterUsage || 0) * (this.waterPrice || 0);
  const itemsTotal = (this.items || []).reduce((sum, i) => sum + i.total, 0);

  this.totalAmount =
    (this.roomPrice || 0) +
    electricTotal +
    waterTotal +
    (this.serviceFee || 0) +
    itemsTotal;
});

module.exports = mongoose.model("Invoice", invoiceSchema);
