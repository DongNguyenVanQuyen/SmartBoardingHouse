//src/models/Invoice.js
const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema(
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

    // Loại hóa đơn: "rent" = hóa đơn tiền phòng/điện/nước hàng tháng,
    // "deposit" = hóa đơn tiền cọc hợp đồng (chỉ tạo 1 lần duy nhất / hợp đồng).
    type: {
      type: String,
      enum: ["rent", "deposit"],
      default: "rent",
    },

    // Các khoản phí cố định hàng tháng (khớp Admin)
    roomPrice: { type: Number, default: 0 },
    electricUsage: { type: Number, default: 0 },
    electricPrice: { type: Number, default: 0 },
    waterUsage: { type: Number, default: 0 },
    waterPrice: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },

    // Chỉ dùng khi type = "deposit": số tiền cọc của hợp đồng.
    depositAmount: { type: Number, default: 0 },
    // Đã gửi thông báo "liên hệ lấy lại cọc" khi hợp đồng kết thúc chưa
    // (chỉ áp dụng cho hóa đơn cọc đã thanh toán, đảm bảo chỉ gửi 1 lần).
    depositRefundNoticeSent: { type: Boolean, default: false },

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
      // "cancelled": hóa đơn (thường là hóa đơn cọc) bị hủy vì hợp đồng đã
      // hết hạn/bị hủy trước khi tenant kịp thanh toán — không thể thanh toán nữa.
      enum: ["unpaid", "partial", "paid", "overdue", "cancelled"],
      default: "unpaid",
    },
    receiptImage: { type: String, default: null },
    note: { type: String },
  },
  { timestamps: true, versionKey: false },
);

// Tự tính totalAmount:
// - Hóa đơn tiền cọc (type = "deposit"): totalAmount = depositAmount (không cộng gì khác).
// - Hóa đơn hàng tháng (type = "rent"): roomPrice + điện + nước + dịch vụ + tổng items phụ.
InvoiceSchema.pre("validate", function () {
  if (this.type === "deposit") {
    this.totalAmount = this.depositAmount || 0;
    return;
  }

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

module.exports = mongoose.model("Invoice", InvoiceSchema);