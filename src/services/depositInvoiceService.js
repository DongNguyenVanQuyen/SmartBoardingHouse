// src/services/depositInvoiceService.js
//
// Xử lý hóa đơn TIỀN CỌC của hợp đồng.
// Quy tắc:
//  1. Mỗi hợp đồng chỉ có ĐÚNG 1 hóa đơn cọc duy nhất (type = "deposit"),
//     tạo 1 lần khi hợp đồng bắt đầu (hoặc lần đầu job quét thấy hợp đồng
//     chưa có hóa đơn cọc).
//  2. Khi hợp đồng KẾT THÚC (hết hạn "expired" hoặc bị admin hủy
//     "terminated"), xử lý theo 2 trường hợp:
//     a) Hóa đơn cọc ĐÃ thanh toán (paid) -> gửi thông báo cho tenant biết
//        cần liên hệ quản lý để lấy lại tiền cọc (chỉ gửi 1 lần).
//     b) Hóa đơn cọc CHƯA thanh toán xong (unpaid/partial) -> hủy hóa đơn
//        (status = "cancelled") để tenant không thể thanh toán tiếp nữa,
//        kèm thông báo giải thích lý do.
const Invoice = require("../models/Invoice");
const Room = require("../models/Room");
const { createAndPushNotification } = require("./notificationService");

// Tạo hóa đơn cọc cho 1 hợp đồng — CHỈ TẠO 1 LẦN DUY NHẤT.
// Idempotent: gọi lại nhiều lần cũng không tạo thêm hóa đơn cọc thứ 2.
const ensureDepositInvoice = async (contract) => {
  if (!contract) return null;

  // Đã có hóa đơn cọc cho hợp đồng này rồi -> không tạo lại.
  const existing = await Invoice.findOne({
    contract: contract._id,
    type: "deposit",
  });
  if (existing) return existing;

  // Hợp đồng không có tiền cọc -> không cần tạo hóa đơn.
  if (!contract.deposit || contract.deposit <= 0) return null;

  const room = await Room.findById(contract.room);
  const refDate = contract.signedDate || contract.startDate || new Date();
  const month = refDate.getMonth() + 1;
  const year = refDate.getFullYear();

  const depositInvoice = await Invoice.create({
    invoiceNumber: `DEP-${contract.contractNumber || String(contract._id).slice(-8)}`,
    tenant: contract.tenant,
    room: contract.room,
    contract: contract._id,
    tenantName: contract.tenantName,
    roomNumber: room ? room.roomNumber : contract.roomNumber,
    type: "deposit",
    month,
    year,
    dueDate: contract.startDate || refDate,
    depositAmount: contract.deposit,
    note: "Hóa đơn tiền cọc hợp đồng — chỉ thu 1 lần duy nhất khi bắt đầu hợp đồng.",
  });

  await createAndPushNotification({
    tenant: contract.tenant,
    title: "Hóa đơn tiền cọc",
    body: `Hợp đồng ${contract.contractNumber || ""} phát sinh hóa đơn tiền cọc ${contract.deposit.toLocaleString("vi-VN")}đ. Vui lòng thanh toán.`,
    type: "invoice",
    refId: depositInvoice._id,
    refModel: "Invoice",
  });

  return depositInvoice;
};

// Xử lý hóa đơn cọc khi hợp đồng đã kết thúc (hết hạn hoặc bị hủy).
const handleContractEnded = async (contract) => {
  if (!contract) return;
  if (!["expired", "terminated"].includes(contract.status)) return;

  const depositInvoice = await Invoice.findOne({
    contract: contract._id,
    type: "deposit",
  });
  if (!depositInvoice) return;

  const reasonText =
    contract.status === "terminated"
      ? "đã bị quản trị viên hủy"
      : "đã hết hạn";

  if (depositInvoice.status === "paid") {
    // TH1: Đã thanh toán cọc -> thông báo liên hệ lấy lại cọc (chỉ 1 lần).
    if (!depositInvoice.depositRefundNoticeSent) {
      await createAndPushNotification({
        tenant: contract.tenant,
        title: "Hợp đồng kết thúc — hoàn tiền cọc",
        body: `Hợp đồng ${contract.contractNumber || ""} ${reasonText}. Vui lòng liên hệ quản lý để được hoàn lại tiền cọc.`,
        type: "invoice",
        refId: depositInvoice._id,
        refModel: "Invoice",
      });

      depositInvoice.depositRefundNoticeSent = true;
      await depositInvoice.save();
    }
  } else if (["unpaid", "partial"].includes(depositInvoice.status)) {
    // TH2: Hợp đồng kết thúc trước khi tenant kịp thanh toán cọc xong
    // -> hủy hóa đơn, KHÔNG cho thanh toán tiền cọc nữa.
    depositInvoice.status = "cancelled";
    depositInvoice.note = [
      depositInvoice.note,
      `Hợp đồng ${reasonText} trước khi thanh toán xong — hóa đơn cọc đã bị hủy, không thể thanh toán.`,
    ]
      .filter(Boolean)
      .join(" | ");
    await depositInvoice.save();

    await createAndPushNotification({
      tenant: contract.tenant,
      title: "Hóa đơn tiền cọc đã bị hủy",
      body: `Hợp đồng ${contract.contractNumber || ""} ${reasonText} trước khi bạn thanh toán tiền cọc. Hóa đơn tiền cọc đã được hủy và không thể thanh toán nữa.`,
      type: "invoice",
      refId: depositInvoice._id,
      refModel: "Invoice",
    });
  }
  // Nếu depositInvoice.status === "cancelled" hoặc "overdue" đã xử lý rồi thì bỏ qua.
};

module.exports = { ensureDepositInvoice, handleContractEnded };