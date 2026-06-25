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
  console.log(
    `Generating invoice for tenant ${tenantId}, room ${roomId}, month ${month}, year ${year}`,
  );
  console.log(
    `Rent: ${rentAmount}, Electric: ${electricAmount}, Water: ${waterAmount}, Total: ${totalAmount}`,
  );
  let invoice = await Invoice.findOne({ tenant: tenantId, month, year });

  if (invoice) {
    invoice.items = items;
    invoice.totalAmount = totalAmount; // <-- trước đây bị thiếu, nên số tiền không khớp items
    await invoice.save();
    return invoice;
  } else {
    return await Invoice.create({
      tenant: tenantId,
      room: roomId,
      month,
      year,
      dueDate: new Date(year, month - 1, 25),
      items,
      totalAmount, // <-- thêm khi tạo mới
    });
  }
};

module.exports = { generateInvoice };
