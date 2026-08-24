const mongoose = require("mongoose");

const ItemFeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // Tên khoản phí: "Tiền rác", "Wifi cáp quang", "Gửi xe máy"
    price: { type: Number, required: true }, // Số tiền đơn giá
    unit: { type: String, default: "tháng" }, // Đơn vị tính: "tháng", "xe",...
    // Loại phí áp dụng:
    // "mandatory" = bắt buộc cho tất cả các phòng (ví dụ: Tiền rác)
    // "wifi" = chỉ áp dụng cho phòng đăng ký wifi (room.amenities chứa 'wifi')
    // "parking" = chỉ áp dụng cho phòng có gửi xe (room.amenities chứa 'parking')
    // "electric" = đơn giá điện (dùng khi tính hóa đơn hoặc lưu chỉ số mới)
    // "water" = đơn giá nước (dùng khi tính hóa đơn hoặc lưu chỉ số mới)
    type: {
      type: String,
      default: "mandatory",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("ItemFee", ItemFeeSchema);
