//src/configs/cloudinary.js
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage cho avatar
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "tenant-app/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
    public_id: (req) => `avatar_${req.user.id}_${Date.now()}`,
  },
});

// Storage cho ảnh công tơ
const meterStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "tenant-app/meter-readings",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req) => `meter_${req.user.id}_${Date.now()}`,
  },
});

// Storage riêng cho ảnh công tơ điện/nước
const meterReadingStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "smartboarding/meter-readings",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1280, crop: "limit" }], // ảnh công tơ không cần quá to
  },
});

const uploadMeterReading = multer({
  storage: meterReadingStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Storage cho ảnh sửa chữa
const maintenanceStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "smartboarding/maintenance",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],

    // Giới hạn kích thước ảnh, tránh ảnh điện thoại quá lớn
    transformation: [
      {
        width: 1600,
        crop: "limit",
      },
    ],

    // Tạo tên riêng cho từng ảnh
    // Có random để tránh trùng khi upload nhiều ảnh cùng lúc
    public_id: `maintenance_${req.user?._id || "tenant"}_${Date.now()}_${Math.round(
      Math.random() * 1e9
    )}`,
  }),
});

// Storage cho ảnh chat (tenant <-> admin)
// req.user tồn tại với Tenant (từ JWT thật), với Admin có thể không có "id" DB
// nên fallback sang "admin" để tránh lỗi khi build public_id.
const chatImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "smartboarding/chat",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1600, crop: "limit" }],
    public_id: (req) => {
      const uid = req.user?.role === "Tenant" ? req.user._id : "admin";
      return `chat_${uid}_${Date.now()}`;
    },
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadMeter = multer({
  storage: meterStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadMaintenance = multer({
  storage: maintenanceStorage,

  limits: {
    fileSize: 10 * 1024 * 1024, // tối đa 10MB / ảnh
    files: 5, // tối đa 5 ảnh
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ được phép tải lên file hình ảnh"), false);
    }
  },
});

// Giới hạn 8MB, đủ cho ảnh chụp từ điện thoại nhưng không quá nặng khi gửi qua chat
const uploadChatImage = multer({
  storage: chatImageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = {
  cloudinary,
  uploadAvatar,
  uploadMeter,
  uploadMaintenance,
  uploadMeterReading,
  uploadChatImage,
};
