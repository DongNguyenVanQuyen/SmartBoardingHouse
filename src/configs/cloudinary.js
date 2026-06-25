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

// Storage cho ảnh sửa chữa
const maintenanceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "tenant-app/maintenance",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req) => `maintenance_${req.user.id}_${Date.now()}`,
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
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { cloudinary, uploadAvatar, uploadMeter, uploadMaintenance };
