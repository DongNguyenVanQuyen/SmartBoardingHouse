//src/models/Tenant.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const tenantSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: null }, // Cloudinary URL
    idCard: { type: String, trim: true },
    dateOfBirth: { type: Date },
    address: { type: String, trim: true },
    refreshToken: { type: String, default: null },
    fcmToken: { type: String, default: null }, // Firebase FCM
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Hash password trước khi lưu
tenantSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// So sánh password
tenantSchema.methods.comparePassword = async function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

// Ẩn password khi trả về JSON
tenantSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model("Tenant", tenantSchema);
