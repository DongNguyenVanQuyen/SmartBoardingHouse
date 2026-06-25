//src/models/Floor.js
const mongoose = require("mongoose");

const floorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Tầng 1", "Tầng 2"
    floorNumber: { type: Number, required: true },
    description: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Floor", floorSchema);
