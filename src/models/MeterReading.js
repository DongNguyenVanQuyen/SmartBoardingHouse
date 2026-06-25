//src/models/MeterReading.js
const mongoose = require("mongoose");

const meterReadingSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    type: { type: String, enum: ["electric", "water"], required: true },
    currentReading: { type: Number, required: true }, // Chỉ số hiện tại
    previousReading: { type: Number, default: 0 }, // Chỉ số trước
    usage: { type: Number }, // Tiêu thụ = current - previous
    unitPrice: { type: Number }, // Giá/đơn vị
    totalCost: { type: Number }, // usage * unitPrice
    imageUrl: { type: String }, // Cloudinary URL ảnh công tơ
    readingDate: { type: Date, default: Date.now },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    ocrRawText: { type: String }, // Raw text từ OCR
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Tự tính usage và totalCost
meterReadingSchema.pre("save", function (next) {
  if (this.currentReading != null && this.previousReading != null) {
    this.usage = this.currentReading - this.previousReading;
  }
  if (this.usage != null && this.unitPrice != null) {
    this.totalCost = this.usage * this.unitPrice;
  }
  next();
});

module.exports = mongoose.model("MeterReading", meterReadingSchema);
