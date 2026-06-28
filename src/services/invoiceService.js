// src/services/invoiceService.js
const Invoice = require("../models/Invoice");
const MeterReading = require("../models/MeterReading");
const Room = require("../models/Room");

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
  // Nếu chưa có chỉ số -> mặc định 0, có rồi thì tính lại đúng giá trị mới
  const electricAmount = electricReading ? electricReading.totalCost : 0;
  const waterAmount = waterReading ? waterReading.totalCost : 0;

  const items = [
    {
      name: "Tiền phòng",
      quantity: 1,
      unitPrice: rentAmount,
      total: rentAmount,
    },
  ];

  if (electricReading) {
    items.push({
      name: "Tiền điện",
      quantity: electricReading.usage,
      unitPrice: electricReading.unitPrice,
      total: electricReading.totalCost,
    });
  }

  if (waterReading) {
    items.push({
      name: "Tiền nước",
      quantity: waterReading.usage,
      unitPrice: waterReading.unitPrice,
      total: waterReading.totalCost,
    });
  }

  // luôn tính lại totalAmount = tiền phòng + điện + nước
  const totalAmount = rentAmount + electricAmount + waterAmount;

  // Các field chi tiết khớp model mới (để Admin/.NET đọc đúng số liệu,
  // không phải suy ra từ items nữa)
  const detailFields = {
    roomPrice: rentAmount,
    electricUsage: electricReading ? electricReading.usage : 0,
    electricPrice: electricReading ? electricReading.unitPrice : 0,
    waterUsage: waterReading ? waterReading.usage : 0,
    waterPrice: waterReading ? waterReading.unitPrice : 0,
    serviceFee: 0,
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
    invoice.totalAmount = totalAmount;
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
      totalAmount,
    });
  }
};

module.exports = { generateInvoice };
