//src/models/Floor.js
const mongoose = require("mongoose");

const floorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Tầng 1", "Tầng 2"
    floorNumber: { type: Number, required: true },
    description: { type: String },
    // roomCount KHÔNG lưu cứng ở đây — tính runtime bằng
    // Room.countDocuments({ floor: this._id }) để tránh lệch dữ liệu
    // với phía Admin (Admin cũng phải tính runtime, không cache field này).
  },
  { timestamps: true },
);

module.exports = mongoose.model("Floor", floorSchema);
