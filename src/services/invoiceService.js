// src/services/invoiceService.js
const Invoice = require("../models/Invoice");
const MeterReading = require("../models/MeterReading");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const ItemFee = require("../models/ItemFee");
const { createAndPushNotification } = require("./notificationService");
const { ensureDepositInvoice } = require("./depositInvoiceService");

const generateInvoice = async (tenantId, roomId, contractId, month, year) => {
  if (!contractId) {
    throw new Error(
      "generateInvoice: thiếu contractId — bắt buộc để tách hóa đơn theo từng hợp đồng"
    );
  }

  const room = await Room.findById(roomId);
  if (!room) return;

  const contract = await Contract.findById(contractId);
  if (!contract) return;

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

  // Lấy danh sách các phí cấu hình từ bảng ItemFee
  const activeFees = await ItemFee.find({ isActive: true });

  // 🟢 FIX CỐT LÕI TẠI ĐÂY: Tự tính toán số tiêu thụ và thành tiền một cách tường minh
  // (Tránh phụ thuộc vào reading.usage / reading.totalCost vì có thể là undefined)
  // Lấy đơn giá điện/nước phòng hờ trường hợp reading thiếu unitPrice
  const electricFee = activeFees.find(f => f.type === "electric");
  const waterFee = activeFees.find(f => f.type === "water");
  const defaultElectricPrice = electricFee ? electricFee.price : 3500;
  const defaultWaterPrice = waterFee ? waterFee.price : 8000;

  let eUsage = 0, ePrice = 0, eCost = 0;
  if (electricReading) {
    eUsage = electricReading.currentReading - electricReading.previousReading;
    if (eUsage < 0) eUsage = 0; // Đề phòng chỉ số bị lùi
    ePrice = electricReading.unitPrice || defaultElectricPrice;
    eCost = eUsage * ePrice;
  }

  let wUsage = 0, wPrice = 0, wCost = 0;
  if (waterReading) {
    wUsage = waterReading.currentReading - waterReading.previousReading;
    if (wUsage < 0) wUsage = 0;
    wPrice = waterReading.unitPrice || defaultWaterPrice;
    wCost = wUsage * wPrice;
  }

  const rentAmount = room.price || 0;
  const electricAmount = eCost;
  const waterAmount = wCost;

  const items = [];
  
  activeFees.forEach((fee) => {
    if (fee.type === "mandatory") {
      items.push({
        name: fee.name,
        quantity: 1,
        unitPrice: fee.price,
        total: fee.price
      });
    } else if (room.amenities && room.amenities.includes(fee.type)) {
      // 🟢 Khớp động: Nếu loại phí trùng với bất kỳ tiện ích nào phòng đang có (ví dụ: "wifi", "parking", "gym", "ac",...)
      items.push({
        name: fee.name,
        quantity: 1,
        unitPrice: fee.price,
        total: fee.price
      });
    }
  });

  const itemsTotal = items.reduce((sum, i) => sum + i.total, 0);
  const totalAmount = rentAmount + electricAmount + waterAmount + itemsTotal;

  const detailFields = {
    roomPrice: rentAmount,
    electricUsage: eUsage,
    electricPrice: ePrice,
    waterUsage: wUsage,
    waterPrice: wPrice,
    serviceFee: 0,
    totalAmount: totalAmount // Chủ động gán totalAmount luôn cho chắc chắn
  };

  console.log(
    `Generating invoice for tenant ${tenantId}, contract ${contractId}, room ${roomId}, month ${month}, year ${year}`
  );
  console.log(
    `Rent: ${rentAmount}, Electric: ${electricAmount}, Water: ${waterAmount}, Total: ${totalAmount}`
  );

  let invoice = await Invoice.findOne({
    contract: contractId,
    type: "rent",
    month,
    year,
  });

  if (invoice) {
    const oldItems = invoice.items || [];
    const itemsTotal = oldItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const newTotalAmount = rentAmount + electricAmount + waterAmount + (invoice.serviceFee || 0) + itemsTotal;

    Object.assign(invoice, {
      roomPrice: rentAmount,
      electricUsage: eUsage,
      electricPrice: ePrice,
      waterUsage: wUsage,
      waterPrice: wPrice,
      totalAmount: newTotalAmount
    });
    await invoice.save();
    return invoice;
  } else {
    const newInvoice = await Invoice.create({
      invoiceNumber: `INV-${room.roomNumber}-${year}${String(month).padStart(2, "0")}-${String(contract._id).slice(-6)}`,
      tenant: tenantId,
      room: roomId,
      contract: contractId,
      roomNumber: room.roomNumber,
      type: "rent",
      month,
      year,
      dueDate: new Date(year, month - 1, 25),
      items,
      ...detailFields,
    });

    await createAndPushNotification({
      tenant: tenantId,
      title: "Hóa đơn mới đã được tạo",
      body: `Hóa đơn tháng ${month}/${year} của phòng ${room.roomNumber} là ${newInvoice.totalAmount.toLocaleString("vi-VN")}đ.`,
      type: "invoice",
      refId: newInvoice._id,
      refModel: "Invoice",
    });

    return newInvoice;
  }
};

const generateMonthlyInvoicesForAllRooms = async (month, year) => {
  const activeContracts = await Contract.find({ status: "active" });

  const results = { success: 0, failed: [] };

  for (const contract of activeContracts) {
    try {
      await generateInvoice(
        contract.tenant,
        contract.room,
        contract._id,
        month,
        year,
      );

      await ensureDepositInvoice(contract);
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