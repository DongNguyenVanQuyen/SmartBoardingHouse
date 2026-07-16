// src/services/invoiceService.js
const Invoice = require("../models/Invoice");
const MeterReading = require("../models/MeterReading");
const Room = require("../models/Room");
const Contract = require("../models/Contract");

const generateInvoice = async (tenantId, roomId, month, year) => {
  const room = await Room.findById(roomId);
  if (!room) return;

  const readings = await MeterReading.find({
    tenant: tenantId,
    room: roomId,
    month,
    year,
  });

  let electricReading = null;
  let waterReading = null;

  readings.forEach((reading) => {
    if (reading.type === "electric") electricReading = reading;
    if (reading.type === "water") waterReading = reading;
  });

  const rentAmount = room.price;
  const electricAmount = electricReading ? electricReading.totalCost : 0;
  const waterAmount = waterReading ? waterReading.totalCost : 0;

  // ⚠️ QUAN TRỌNG: KHÔNG đẩy "Tiền phòng/điện/nước" vào items[] nữa.
  // Model Invoice có pre("save") hook tự tính lại totalAmount bằng:
  //   roomPrice + electricTotal + waterTotal + serviceFee + itemsTotal
  // Nếu items[] cũng chứa lại 3 khoản này thì bị CỘNG TRÙNG (nhân đôi tiền).
  // items[] giờ chỉ dùng cho phụ phí phát sinh khác (không phải phòng/điện/nước).
  const items = [];

  const totalAmount = rentAmount + electricAmount + waterAmount;

  const detailFields = {
    roomPrice: rentAmount,
    electricUsage: electricReading ? electricReading.usage : 0,
    electricPrice: electricReading ? electricReading.unitPrice : 0,
    waterUsage: waterReading ? waterReading.usage : 0,
    waterPrice: waterReading ? waterReading.unitPrice : 0,
    serviceFee: 0,
    totalAmount, // KHÔNG set totalAmount thủ công nữa — pre("save") hook tự tính.
  };

  console.log(
    `Generating invoice for tenant ${tenantId}, room ${roomId}, month ${month}, year ${year}`,
  );
  console.log(
    `Rent: ${rentAmount}, Electric: ${electricAmount}, Water: ${waterAmount}, Total: ${totalAmount}`,
  );

  let invoice = await Invoice.findOne({
    tenant: tenantId,
    room: roomId,
    month,
    year,
  });

  if (invoice) {
    invoice.items = items;
    Object.assign(invoice, detailFields);
    // Không set invoice.totalAmount thủ công — pre("save") hook của Invoice
    // model sẽ tự tính lại đúng từ detailFields + items (giờ rỗng, không trùng nữa).
    await invoice.save();
    return invoice;
  } else {
    return await Invoice.create({
      invoiceNumber: `INV-${room.roomNumber}-${year}${String(month).padStart(2, "0")}`,
      tenant: tenantId,
      room: roomId,
      roomNumber: room.roomNumber,
      month,
      year,
      dueDate: new Date(year, month - 1, 25),
      items,
      ...detailFields,
      // Không truyền totalAmount ở đây nữa — hook pre("save") tự tính.
    });
  }
};

// Chạy cho TẤT CẢ hợp đồng đang active, dùng cho cron ngày 15 hàng tháng
const generateMonthlyInvoicesForAllRooms = async (month, year) => {
  const activeContracts = await Contract.find({ status: "active" });

  const results = { success: 0, failed: [] };

  for (const contract of activeContracts) {
    try {
      await generateInvoice(contract.tenant, contract.room, month, year);
      results.success++;
    } catch (err) {
      results.failed.push({ contractId: contract._id, error: err.message });
    }
  }

  console.log(
    `[InvoiceGeneration] Tháng ${month}/${year}: thành công ${results.success}, lỗi ${results.failed.length}`,
  );
  if (results.failed.length) console.error(results.failed);

  return results;
};

module.exports = { generateInvoice, generateMonthlyInvoicesForAllRooms };
