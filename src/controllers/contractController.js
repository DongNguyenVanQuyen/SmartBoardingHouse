//src/controllers/contractController.js
const Contract = require("../models/Contract");
const { success, error: sendError } = require("../utils/response");

// GET /contracts
const getContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({ tenant: req.user._id })
      .populate("room", "roomNumber price area")
      .sort({ createdAt: -1 });

    return success(res, contracts, "Lấy danh sách hợp đồng thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /contracts/:id
const getContractById = async (req, res) => {
  try {
    const contract = await Contract.findOne({
      _id: req.params.id,
      tenant: req.user._id,
    }).populate("room", "roomNumber price area floor amenities");

    if (!contract) return sendError(res, "Không tìm thấy hợp đồng", 404);

    return success(res, contract, "Lấy thông tin hợp đồng thành công");
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getContracts, getContractById };

