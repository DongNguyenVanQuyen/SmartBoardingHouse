require("dotenv").config();
const mongoose = require("mongoose");

const Tenant = require("./src/models/Tenant");
const Room = require("./src/models/Room");
const Contract = require("./src/models/Contract");
const Invoice = require("./src/models/Invoice");
const Payment = require("./src/models/Payment");
const MeterReading = require("./src/models/MeterReading");
const MaintenanceRequest = require("./src/models/MaintenanceRequest");

const TENANT_ID = "6a57b630b5cf8630fa15bea0"; // ID cũ cần xóa

async function clearSeed() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "SmartBoardingHouse",
    });

    const roomIds = (await Room.find({ tenant: TENANT_ID }).select("_id")).map(
      (r) => r._id,
    );

    await Tenant.deleteOne({ _id: TENANT_ID });
    await Payment.deleteMany({ tenant: TENANT_ID });
    await Invoice.deleteMany({ tenant: TENANT_ID });
    await MeterReading.deleteMany({ tenant: TENANT_ID });
    await MaintenanceRequest.deleteMany({ tenant: TENANT_ID });
    await Contract.deleteMany({ tenant: TENANT_ID });
    await Room.deleteMany({ tenant: TENANT_ID });

    console.log(`Đã xóa dữ liệu của tenant ${TENANT_ID}`);
    console.log(`Đã xóa ${roomIds.length} phòng.`);

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

clearSeed();
