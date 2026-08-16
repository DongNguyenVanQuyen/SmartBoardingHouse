//src/controllers/roomController.js
const { resolveSelectedContract } = require("../services/roomSelectionService");
const { success, error: sendError } = require("../utils/response");

// GET /rooms/current
// Trả về phòng ĐANG CHỌN (đồng bộ với Dashboard/Invoice/chụp công tơ) —
// không còn lấy đại một hợp đồng active bất kỳ nữa, để nhất quán khi tenant
// thuê nhiều phòng cùng lúc và đã chủ động chuyển phòng.
const getCurrentRoom = async (req, res) => {
  try {
    const { contract, rooms } = await resolveSelectedContract(req.user._id);

    if (!contract) {
      return sendError(res, "Bạn chưa có phòng đang thuê", 404);
    }

    return success(
      res,
      {
        room: contract.room,
        floor: contract.room?.floor || null,
        contract: {
          _id: contract._id,
          contractNumber: contract.contractNumber,
          startDate: contract.startDate,
          endDate: contract.endDate,
          monthlyRent: contract.monthlyRent,
        },
        rooms,
        hasMultipleRooms: rooms.length > 1,
      },
      "Lấy thông tin phòng thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getCurrentRoom };