const MaintenanceRequest = require("../models/MaintenanceRequest");
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const {
  createAndPushNotification,
} = require("../services/notificationService");
const {
  success,
  error: sendError,
} = require("../utils/response");
const {
  normalizeMaintenanceRequest,
} = require("../utils/maintenanceEnumMap");

// POST /maintenance-requests
const createRequest = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      category,
    } = req.body;

    // ============================
    // VALIDATE
    // ============================

    if (!title || !description) {
      return sendError(
        res,
        "Vui lòng nhập tiêu đề và mô tả",
        400
      );
    }

    // ============================
    // TÌM HỢP ĐỒNG ĐANG THUÊ
    // ============================

    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    });

    if (!contract) {
      return sendError(
        res,
        "Bạn chưa có phòng đang thuê",
        404
      );
    }

    // ============================
    // LẤY URL ẢNH CLOUDINARY
    // ============================
    //
    // multer-storage-cloudinary đã upload ảnh
    // lên Cloudinary trước khi controller chạy.
    //
    // req.files:
    //
    // [
    //   {
    //      fieldname: "images",
    //      path: "https://res.cloudinary.com/...",
    //      filename: "smartboarding/maintenance/..."
    //   }
    // ]
    //
    // Database CHỈ lưu URL.
    // ============================

    const images = Array.isArray(req.files)
      ? req.files
          .map((file) => file.path)
          .filter(Boolean)
      : [];

    console.log(
      "Maintenance Cloudinary URLs:",
      images
    );

    // ============================
    // TÌM PHÒNG
    // ============================

    const room = await Room.findById(
      contract.room
    );

    if (!room) {
      return sendError(
        res,
        "Không tìm thấy thông tin phòng",
        404
      );
    }

    // ============================
    // TẠO MÃ YÊU CẦU
    // ============================

    const count =
      await MaintenanceRequest.countDocuments({
        room: contract.room,
      });

    const requestNumber =
      `MT-${room.roomNumber || "NA"}-` +
      String(count + 1).padStart(3, "0");

    // ============================
    // LƯU DATABASE
    // ============================

    const created =
      await MaintenanceRequest.create({
        requestNumber,

        tenant: req.user._id,

        room: contract.room,

        roomNumber: room.roomNumber,

        tenantName: req.user.fullName,

        title,

        description,

        priority: priority || "medium",

        category: category || "other",

        // Chỉ lưu URL Cloudinary
        images,
      });

    // ============================
    // THÔNG BÁO
    // ============================

    await createAndPushNotification({
      tenant: req.user._id,

      title: "Yêu cầu sửa chữa đã được gửi",

      body: `Yêu cầu "${title}" đang chờ xử lý`,

      type: "maintenance",

      refId: created._id,

      refModel: "MaintenanceRequest",

      tenantDoc: req.user,
    });

    // ============================
    // LẤY LẠI REQUEST
    // ============================

    const request =
      await MaintenanceRequest.findById(
        created._id
      )
        .populate({
          path: "room",

          select: "roomNumber floor",

          populate: {
            path: "floor",

            select: "name floorNumber",
          },
        })
        .lean();

    // ============================
    // RESPONSE
    // ============================

    return success(
      res,

      normalizeMaintenanceRequest(request),

      "Gửi yêu cầu sửa chữa thành công",

      201
    );

  } catch (err) {

    console.error(
      "Create maintenance request error:",
      err
    );

    return sendError(
      res,
      err.message || "Không thể tạo yêu cầu sửa chữa",
      500
    );
  }
};


// GET /maintenance-requests
const getRequests = async (req, res) => {
  try {

    const { status } = req.query;

    const filter = {
      tenant: req.user._id,
    };

    if (status) {
      filter.status = status;
    }

    const requests =
      await MaintenanceRequest.find(filter)
        .populate({
          path: "room",

          select: "roomNumber floor",

          populate: {
            path: "floor",

            select: "name floorNumber",
          },
        })
        .sort({
          createdAt: -1,
        })
        .lean();

    const normalized =
      requests.map(
        normalizeMaintenanceRequest
      );

    return success(
      res,
      normalized,
      "Lấy danh sách yêu cầu thành công"
    );

  } catch (err) {

    console.error(
      "Get maintenance requests error:",
      err
    );

    return sendError(
      res,
      err.message,
      500
    );
  }
};


// GET /maintenance-requests/:id
const getRequestById = async (req, res) => {
  try {

    const request =
      await MaintenanceRequest.findOne({
        _id: req.params.id,
        tenant: req.user._id,
      })
        .populate({
          path: "room",

          select: "roomNumber floor",

          populate: {
            path: "floor",

            select: "name floorNumber",
          },
        })
        .lean();

    if (!request) {

      return sendError(
        res,
        "Không tìm thấy yêu cầu",
        404
      );
    }

    return success(
      res,
      normalizeMaintenanceRequest(request),
      "Lấy thông tin yêu cầu thành công"
    );

  } catch (err) {

    console.error(
      "Get maintenance request error:",
      err
    );

    return sendError(
      res,
      err.message,
      500
    );
  }
};


module.exports = {
  createRequest,
  getRequests,
  getRequestById,
};