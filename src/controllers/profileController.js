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

// Cập nhật thông tin text (thêm 2 trường vào body nếu muốn lưu URL trực tiếp)
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address, idCard, frontImage, backImage } = req.body;
    
    // Kiểm tra định dạng khi người dùng cập nhật thông tin
    if (phone && !/^[0-9]{10,11}$/.test(phone)) {
      return sendError(res, "Số điện thoại không hợp lệ (phải là 10 - 11 số)", 400);
    }
    if (idCard && !/^[0-9]{12}$/.test(idCard)) {
      return sendError(res, "Số CCCD không hợp lệ (phải gồm chính xác 12 số)", 400);
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { fullName, phone, address, idCard, frontImage, backImage },
      { new: true, runValidators: true }
    );
    return success(res, tenant, "Cập nhật thông tin thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// UPLOAD ẢNH CMND 
const uploadIdentityCard = async (req, res) => {
  try {
    if (!req.files || (!req.files.frontImage && !req.files.backImage)) {
      return sendError(res, "Vui lòng chọn ảnh", 400);
    }

    const tenant = await Tenant.findById(req.user._id);
    
    // Nếu có up ảnh mặt trước
    if (req.files.frontImage && req.files.frontImage[0]) {
      tenant.frontImage = req.files.frontImage[0].path;
    }
    // Nếu có up ảnh mặt sau
    if (req.files.backImage && req.files.backImage[0]) {
      tenant.backImage = req.files.backImage[0].path;
    }

    await tenant.save();
    return success(res, { 
      frontImage: tenant.frontImage, 
      backImage: tenant.backImage 
    }, "Cập nhật ảnh CMND thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  uploadIdentityCard 
};
