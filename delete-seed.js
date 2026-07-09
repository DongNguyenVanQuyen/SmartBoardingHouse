// clear-data.js
require("dotenv").config();
const mongoose = require("mongoose");

async function clearData() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "SmartBoardingHouse",
    });
    console.log("MongoDB Connected -> DB:", mongoose.connection.name);

    const collections = [
      "floors",
      "rooms",
      "contracts",
      "invoices",
      "payments",
      "meterreadings",
      "maintenancerequests",
      "notifications",
      "messages",
      // "tenants", // bỏ comment dòng này nếu muốn xóa luôn tài khoản tenant
    ];

    for (const name of collections) {
      const result = await mongoose.connection.db
        .collection(name)
        .deleteMany({});
      console.log(`✓ Đã xóa ${result.deletedCount} document trong "${name}"`);
    }

    console.log("\n✅ Xóa dữ liệu hoàn tất!");
    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Lỗi khi xóa dữ liệu:", error.message);
    process.exit(1);
  }
}

clearData();
