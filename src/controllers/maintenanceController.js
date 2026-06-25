const MaintenanceRequest = require("../models/MaintenanceRequest");
const Contract = require("../models/Contract");
const Notification = require("../models/Notification");
const { success, error: sendError } = require("../utils/response");

// POST /maintenance-requests
const createRequest = async (req, res) => {
  try {
    const { title, description, priority, category } = req.body;

    if (!title || !description) {
      return sendError(res, "Vui lòng nhập tiêu đề và mô tả", 400);
    }

    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    });

    if (!contract) {
      return sendError(res, "Bạn chưa có phòng đang thuê", 404);
    }

    const images = req.files ? req.files.map((f) => f.path) : [];

    const created = await MaintenanceRequest.create({
      tenant: req.user._id,
      room: contract.room,
      title,
      description,
      priority: priority || "medium",
      category: category || "other",
      images,
    });

    await Notification.create({
      tenant: req.user._id,
      title: "Yêu cầu sửa chữa đã được gửi",
      body: `Yêu cầu "${title}" đang chờ xử lý`,
      type: "maintenance",
      refId: created._id,
      refModel: "MaintenanceRequest",
    });

    const request = await MaintenanceRequest.findById(created._id).populate({
      path: "room",
      select: "roomNumber floor",
      populate: {
        path: "floor",
        select: "name floorNumber",
      },
    });

    return success(res, request, "Gửi yêu cầu sửa chữa thành công", 201);
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
      .sort({ createdAt: -1 });

    return success(res, requests, "Lấy danh sách yêu cầu thành công");
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
    }).populate({
      path: "room",
      select: "roomNumber floor",
      populate: {
        path: "floor",
        select: "name floorNumber",
      },
    });

    if (!request) {
      return sendError(res, "Không tìm thấy yêu cầu", 404);
    }

    return success(res, request, "Lấy thông tin yêu cầu thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
};
