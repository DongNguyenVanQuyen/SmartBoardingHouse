//src/models/Room.js
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, unique: true, trim: true },
    floor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Floor",
      required: true,
    },
    price: { type: Number, required: true }, // Giá thuê/tháng
    roomDeposit: { type: Number, default: 0 }, // Tiền cọc khi nhận phòng
    area: { type: Number }, // m²
    maxOccupants: { type: Number, default: 2 },
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    amenities: [{ type: String }], // ["wifi", "ac", "parking"]
    description: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Room", roomSchema);
