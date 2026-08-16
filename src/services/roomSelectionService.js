// src/services/roomSelectionService.js
//
// Một tenant có thể đang thuê nhiều phòng cùng lúc (nhiều hợp đồng "active").
// Service này quản lý "phòng đang chọn" (dùng chung cho Dashboard, Invoice,
// và chụp công tơ) — lưu trên Tenant.room / Tenant.roomNumber.
//
//  - listSelectableRooms: danh sách phòng tenant có thể chuyển tới (chỉ những
//    hợp đồng còn hiệu lực — status "active").
//  - resolveSelectedContract: xác định hợp đồng/phòng đang được chọn để hiển
//    thị (ưu tiên Tenant.room đã lưu, tự đồng bộ lại nếu bị lệch/hết hạn).
//  - selectRoom: hành động "chuyển phòng" — bắt buộc hợp đồng của phòng mới
//    phải thuộc đúng tenant và đang active, rồi lưu lại làm phòng hiện tại.

const Contract = require("../models/Contract");
const Tenant = require("../models/Tenant");

const getActiveContractsForTenant = async (tenantId) => {
  return Contract.find({ tenant: tenantId, status: "active" })
    .populate({
      path: "room",
      populate: { path: "floor", select: "name floorNumber" },
    })
    .sort({ createdAt: -1 });
};

const toRoomOption = (contract, selectedRoomId) => ({
  contractId: contract._id,
  contractNumber: contract.contractNumber,
  roomId: contract.room?._id || null,
  roomNumber: contract.room?.roomNumber || contract.roomNumber,
  floor: contract.room?.floor || null,
  price: contract.room?.price,
  monthlyRent: contract.monthlyRent,
  startDate: contract.startDate,
  endDate: contract.endDate,
  isSelected: selectedRoomId
    ? String(contract.room?._id) === String(selectedRoomId)
    : false,
});

// Danh sách phòng (kèm hợp đồng) mà tenant có thể chọn để hiển thị/thao tác,
// dùng cho màn "chuyển phòng" ở Dashboard hoặc Invoice.
const listSelectableRooms = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).select("room");
  const contracts = await getActiveContractsForTenant(tenantId);
  return contracts.map((c) => toRoomOption(c, tenant?.room));
};

// Xác định hợp đồng/phòng đang được chọn để hiển thị (Dashboard/Invoice).
// Ưu tiên phòng đã lưu trên Tenant.room. Nếu phòng đó không còn hợp đồng
// active nào nữa (vd. hợp đồng hết hạn), tự động rơi về hợp đồng active gần
// nhất và đồng bộ lại Tenant.room cho khớp.
const resolveSelectedContract = async (tenantId) => {
  const activeContracts = await getActiveContractsForTenant(tenantId);
  if (activeContracts.length === 0) {
    return { contract: null, rooms: [] };
  }

  const tenant = await Tenant.findById(tenantId).select("room roomNumber");

  let selected = null;
  if (tenant?.room) {
    selected = activeContracts.find(
      (c) => String(c.room?._id) === String(tenant.room),
    );
  }

  if (!selected) {
    selected = activeContracts[0];
    const needsSync =
      String(tenant?.room || "") !== String(selected.room?._id || "");
    if (needsSync && tenant) {
      tenant.room = selected.room?._id || null;
      tenant.roomNumber = selected.room?.roomNumber || selected.roomNumber;
      await tenant.save();
    }
  }

  return {
    contract: selected,
    rooms: activeContracts.map((c) => toRoomOption(c, selected.room?._id)),
  };
};

// Chuyển phòng đang chọn. Bắt buộc hợp đồng của phòng muốn chuyển tới phải
// thuộc về tenant hiện tại và đang "active" (còn hiệu lực) — không cho chuyển
// sang phòng có hợp đồng đã hết hạn/bị hủy.
const selectRoom = async (tenantId, contractId) => {
  if (!contractId) {
    const err = new Error("Vui lòng chọn hợp đồng/phòng muốn chuyển đến");
    err.statusCode = 400;
    throw err;
  }

  const contract = await Contract.findOne({
    _id: contractId,
    tenant: tenantId,
    status: "active",
  }).populate({
    path: "room",
    populate: { path: "floor", select: "name floorNumber" },
  });

  if (!contract) {
    const err = new Error(
      "Hợp đồng không tồn tại hoặc không còn hiệu lực — không thể chuyển phòng",
    );
    err.statusCode = 404;
    throw err;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const err = new Error("Không tìm thấy người dùng");
    err.statusCode = 404;
    throw err;
  }

  tenant.room = contract.room?._id || null;
  tenant.roomNumber = contract.room?.roomNumber || contract.roomNumber;
  await tenant.save();

  return contract;
};

module.exports = {
  getActiveContractsForTenant,
  listSelectableRooms,
  resolveSelectedContract,
  selectRoom,
};