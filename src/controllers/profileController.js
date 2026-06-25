//src/controllers/profileController.js
const Tenant = require("../models/Tenant");
const { success, error: sendError } = require("../utils/response");

// GET /profile
const getProfile = async (req, res) => {
  try {
    return success(res, req.user, "Lấy thông tin thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, idCard, dateOfBirth, address } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { fullName, phone, idCard, dateOfBirth, address },
      { new: true, runValidators: true },
    );

    return success(res, tenant, "Cập nhật thông tin thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /profile/avatar
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) return sendError(res, "Vui lòng chọn ảnh", 400);

    const avatarUrl = req.file.path; // Cloudinary URL

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true },
    );

    return success(
      res,
      { avatar: tenant.avatar },
      "Cập nhật avatar thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getProfile, updateProfile, updateAvatar };

