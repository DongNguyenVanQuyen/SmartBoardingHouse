const MaintenanceRequest = require("../models/MaintenanceRequest");
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const { createAndPushNotification } = require("../services/notificationService");
const { resolveSelectedContract } = require("../services/roomSelectionService"); // Thêm service này
const { success, error: sendError } = require("../utils/response");
const { normalizeMaintenanceRequest } = require("../utils/maintenanceEnumMap");

// POST /maintenance-requests
const createRequest = async (req, res) => {
  try {
    // Thêm trường contract vào req.body (từ form-data)
    const { title, description, priority, category, contract: contractId } = req.body;

    if (!title || !description) {
      return sendError(res, "Vui lòng nhập tiêu đề và mô tả", 400);
    }

    // 🟢 LOGIC TÌM HỢP ĐỒNG (PHÒNG)
    let contract;
    if (contractId) {
      // Nếu App gửi ID phòng lên -> Lấy đúng phòng đó
      contract = await Contract.findOne({
        _id: contractId,
        tenant: req.user._id,
        status: "active",
      });
      if (!contract) {
        return sendError(res, "Phòng không hợp lệ hoặc đã hết hạn thuê", 404);
      }
    } else {
      // Nếu App không gửi -> Lấy mặc định phòng đang chọn ở Dashboard
      const resolved = await resolveSelectedContract(req.user._id);
      contract = resolved.contract;
      if (!contract) {
        return sendError(res, "Bạn chưa có phòng đang thuê", 404);
      }
    }

    const images = req.files ? req.files.map((f) => f.path) : [];

    const room = await Room.findById(contract.room);
    const count = await MaintenanceRequest.countDocuments({
      room: contract.room,
    });
    const requestNumber = `MT-${room?.roomNumber || "NA"}-${String(count + 1).padStart(3, "0")}`;

    const created = await MaintenanceRequest.create({
      requestNumber,
      tenant: req.user._id,
      room: contract.room, // 🟢 Gán đúng phòng đã chọn
      roomNumber: room?.roomNumber,
      tenantName: req.user.fullName,
      title,
      description,
      priority: priority || "medium",
      category: category || "other",
      images,
    });

    await createAndPushNotification({
      tenant: req.user._id,
      title: "Yêu cầu sửa chữa đã được gửi",
      body: `Yêu cầu "${title}" của phòng ${room?.roomNumber} đang chờ xử lý`,
      type: "maintenance",
      refId: created._id,
      refModel: "MaintenanceRequest",
      tenantDoc: req.user,
    });

    const request = await MaintenanceRequest.findById(created._id)
      .populate({
        path: "room",
        select: "roomNumber floor",
        populate: {
          path: "floor",
          select: "name floorNumber",
        },
      })
      .lean();

    return success(res, normalizeMaintenanceRequest(request), "Gửi yêu cầu sửa chữa thành công", 201);
  } catch (err) {
    return sendError(res, err.message);
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

    const requests = await MaintenanceRequest.find(filter)
      .populate({
        path: "room",
        select: "roomNumber floor",
        populate: {
          path: "floor",
          select: "name floorNumber",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = requests.map(normalizeMaintenanceRequest);

    return success(res, normalized, "Lấy danh sách yêu cầu thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /maintenance-requests/:id
const getRequestById = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findOne({
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
      return sendError(res, "Không tìm thấy yêu cầu", 404);
    }

    return success(res, normalizeMaintenanceRequest(request), "Lấy thông tin yêu cầu thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
};