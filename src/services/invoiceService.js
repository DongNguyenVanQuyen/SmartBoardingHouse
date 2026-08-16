// src/services/invoiceService.js
const Invoice = require("../models/Invoice");
const MeterReading = require("../models/MeterReading");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const { createAndPushNotification } = require("./notificationService");
const { ensureDepositInvoice } = require("./depositInvoiceService");

// ⚠️ QUAN TRỌNG: contractId là bắt buộc.
// Trước đây hàm này chỉ khớp hóa đơn theo (tenant, room, month, year) — nếu 1
// tenant có nhiều hợp đồng (kể cả nhiều hợp đồng cùng phòng theo thời gian,
// hoặc nhiều phòng khác nhau), các lần gọi generateInvoice cho từng hợp đồng
// có thể bị gộp / ghi đè lên nhau, dẫn tới chỉ còn 1 hóa đơn cho cả tháng dù
// có 2 hợp đồng. Nay bắt buộc truyền contractId và dùng nó làm khóa chính để
// tách hóa đơn riêng biệt cho từng hợp đồng.
const generateInvoice = async (tenantId, roomId, contractId, month, year) => {
  if (!contractId) {
    throw new Error(
      "generateInvoice: thiếu contractId — bắt buộc để tách hóa đơn theo từng hợp đồng",
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
    `Generating invoice for tenant ${tenantId}, contract ${contractId}, room ${roomId}, month ${month}, year ${year}`,
  );
  console.log(
    `Rent: ${rentAmount}, Electric: ${electricAmount}, Water: ${waterAmount}, Total: ${totalAmount}`,
  );

  // Khớp hóa đơn theo ĐÚNG hợp đồng (contract) + tháng/năm, KHÔNG chỉ theo
  // (tenant, room) nữa — đây là chỗ fix bug 2 hợp đồng chỉ ra 1 hóa đơn.
  let invoice = await Invoice.findOne({
    contract: contractId,
    type: "rent",
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
    const newInvoice = await Invoice.create({
      // Thêm contractNumber (hoặc contractId) vào mã hóa đơn để tránh đụng độ
      // khi 2 hợp đồng khác nhau rơi vào cùng phòng + cùng tháng/năm
      // (ví dụ hợp đồng cũ kết thúc, hợp đồng mới ký lại cùng phòng).
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
      // Không truyền totalAmount ở đây nữa — hook pre("save") tự tính.
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

// Chạy cho TẤT CẢ hợp đồng đang active, dùng cho cron ngày 15 hàng tháng.
// Lặp theo TỪNG hợp đồng (không gộp theo tenant/room), nên 1 tenant có nhiều
// hợp đồng sẽ luôn nhận đủ 1 hóa đơn tiền phòng riêng cho mỗi hợp đồng.
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

      // Đảm bảo mỗi hợp đồng có đúng 1 hóa đơn tiền cọc duy nhất (tạo nếu
      // chưa có, bỏ qua nếu đã tồn tại — xem depositInvoiceService).
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