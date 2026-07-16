require("dotenv").config();
const mongoose = require("mongoose");

const Invoice = require("./src/models/Invoice");
const Payment = require("./src/models/Payment");
const MeterReading = require("./src/models/MeterReading");

const TENANT_ID = "6a57b9b91781a515545c4ab9";

async function clearJuly2026() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "SmartBoardingHouse",
    });

    console.log("MongoDB Connected");

    // 1. Lấy hóa đơn tháng 7/2026
    const invoices = await Invoice.find({
      tenant: TENANT_ID,
      month: 7,
      year: 2026,
    });

    const invoiceIds = invoices.map((i) => i._id);

    // 2. Xóa Payment của hóa đơn đó
    const paymentResult = await Payment.deleteMany({
      invoice: { $in: invoiceIds },
    });

    // 3. Xóa Invoice tháng 7/2026
    const invoiceResult = await Invoice.deleteMany({
      tenant: TENANT_ID,
      month: 7,
      year: 2026,
    });

    // 4. Xóa chỉ số điện
    const electricResult = await MeterReading.deleteMany({
      tenant: TENANT_ID,
      type: "electric",
      month: 7,
      year: 2026,
    });

    // 5. Xóa chỉ số nước
    const waterResult = await MeterReading.deleteMany({
      tenant: TENANT_ID,
      type: "water",
      month: 7,
      year: 2026,
    });

    console.log("\n===== DONE =====");
    console.log(`Payments deleted      : ${paymentResult.deletedCount}`);
    console.log(`Invoices deleted      : ${invoiceResult.deletedCount}`);
    console.log(`Electric readings     : ${electricResult.deletedCount}`);
    console.log(`Water readings        : ${waterResult.deletedCount}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clearJuly2026();