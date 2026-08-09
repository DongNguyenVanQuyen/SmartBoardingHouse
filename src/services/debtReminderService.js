// src/services/debtReminderService.js
const Invoice = require("../models/Invoice");
const Notification = require("../models/Notification");
const { createAndPushNotification } = require("./notificationService");

const DAYS_BEFORE_DUE = 3; // nhắc trước 3 ngày đến hạn

// Kiểm tra đã tạo notification cho invoice này, subType này, trong hôm nay chưa (tránh gửi trùng)
const alreadyNotifiedToday = async (invoiceId, subType) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const existing = await Notification.findOne({
    refId: invoiceId,
    refModel: "Invoice",
    type: "debt",
    "meta.subType": subType,
    createdAt: { $gte: startOfDay },
  });

  return !!existing;
};

// Xử lý các hóa đơn sắp đến hạn (chưa quá hạn)
const notifyUpcomingDue = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + DAYS_BEFORE_DUE);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const invoices = await Invoice.find({
    status: { $in: ["unpaid", "partial"] },
    dueDate: { $gte: targetDate, $lt: nextDay },
  }).populate("tenant");

  let count = 0;

  for (const invoice of invoices) {
    if (!invoice.tenant) continue;

    const alreadySent = await alreadyNotifiedToday(invoice._id, "upcoming");
    if (alreadySent) continue;

    const remaining = invoice.totalAmount - invoice.paidAmount;
    const title = "Hóa đơn sắp đến hạn";
    const body = `Hóa đơn tháng ${invoice.month}/${invoice.year} (còn ${remaining.toLocaleString(
      "vi-VN",
    )}đ) sẽ đến hạn trong ${DAYS_BEFORE_DUE} ngày nữa.`;

    await createAndPushNotification({
      tenant: invoice.tenant._id,
      title,
      body,
      type: "debt",
      refId: invoice._id,
      refModel: "Invoice",
      meta: { subType: "upcoming" },
      tenantDoc: invoice.tenant,
    });

    count++;
  }

  return count;
};

// Xử lý các hóa đơn đã quá hạn
const notifyOverdue = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const invoices = await Invoice.find({
    status: { $in: ["unpaid", "partial", "overdue"] },
    dueDate: { $lt: today },
  }).populate("tenant");

  let count = 0;

  for (const invoice of invoices) {
    if (!invoice.tenant) continue;

    // Cập nhật trạng thái overdue nếu chưa cập nhật
    if (invoice.status !== "overdue") {
      invoice.status = "overdue";
      await invoice.save();
    }

    const alreadySent = await alreadyNotifiedToday(invoice._id, "overdue");
    if (alreadySent) continue;

    const remaining = invoice.totalAmount - invoice.paidAmount;
    const overdueDays = Math.floor(
      (today - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24),
    );

    const title = "Hóa đơn quá hạn thanh toán";
    const body = `Hóa đơn tháng ${invoice.month}/${invoice.year} đã quá hạn ${overdueDays} ngày. Số tiền còn lại: ${remaining.toLocaleString(
      "vi-VN",
    )}đ.`;

    await createAndPushNotification({
      tenant: invoice.tenant._id,
      title,
      body,
      type: "debt",
      refId: invoice._id,
      refModel: "Invoice",
      meta: { subType: "overdue" },
      tenantDoc: invoice.tenant,
    });

    count++;
  }

  return count;
};

// Hàm chính, gọi từ cron job
const runDebtReminders = async () => {
  console.log("[DebtReminder] Bắt đầu kiểm tra công nợ...");

  const upcomingCount = await notifyUpcomingDue();
  const overdueCount = await notifyOverdue();

  console.log(
    `[DebtReminder] Đã gửi ${upcomingCount} thông báo sắp đến hạn, ${overdueCount} thông báo quá hạn.`,
  );
};

module.exports = { runDebtReminders, notifyUpcomingDue, notifyOverdue };