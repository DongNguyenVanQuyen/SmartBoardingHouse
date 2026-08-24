const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const TenantSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["Tenant", "Admin"],
      default: "Tenant",
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10,11}$/, "Số điện thoại không hợp lệ (phải là 10 - 11 số)"]
    },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: null },
    idCard: {
      type: String,
      trim: true,
      match: [/^[0-9]{12}$/, "Số CCCD không hợp lệ (phải gồm chính xác 12 số)"]
    },
    frontImage: { type: String, default: null },
    backImage: { type: String, default: null },
    dateOfBirth: { type: Date },
    address: { type: String, trim: true },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    roomNumber: { type: String, default: null },
    refreshToken: { type: String, default: null },
    refreshTokenExpiry: { type: Date, default: null },
    fcmToken: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    resetOtp: { type: String, default: null, select: false },
    resetOtpExpiry: { type: Date, default: null, select: false },

  },
  { timestamps: true, versionKey: false },
);

TenantSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

TenantSchema.methods.comparePassword = async function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

TenantSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.resetOtp;
  delete obj.resetOtpExpiry;
  return obj;
};

module.exports = mongoose.model("Tenant", TenantSchema, "users");
