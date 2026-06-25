//src/models/Invoice.js
const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    contract: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    dueDate: { type: Date, required: true },
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

// Tự tính totalAmount từ items
invoiceSchema.pre("save", function () {
  this.totalAmount = this.items.reduce((sum, i) => sum + i.total, 0);
});

module.exports = mongoose.model("Invoice", invoiceSchema);
