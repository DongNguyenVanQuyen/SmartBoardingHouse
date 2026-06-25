//src/controllers/roomController.js
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const { success, error: sendError } = require("../utils/response");

// GET /rooms/current
const getCurrentRoom = async (req, res) => {
  try {
    // Lấy hợp đồng đang active
    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    }).populate({
      path: "room",
      populate: { path: "floor" },
    });

    if (!contract) {
      return sendError(res, "Bạn chưa có phòng đang thuê", 404);
    }

    return success(
      res,
      {
        room: contract.room,
        floor: contract.room.floor,
        contract: {
          _id: contract._id,
          startDate: contract.startDate,
          endDate: contract.endDate,
          monthlyRent: contract.monthlyRent,
        },
      },
      "Lấy thông tin phòng thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getCurrentRoom };

