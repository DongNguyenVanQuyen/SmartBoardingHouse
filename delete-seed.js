require("dotenv").config();
const mongoose = require("mongoose");

const Invoice = require("./src/models/Invoice");
const Payment = require("./src/models/Payment");
const MeterReading = require("./src/models/MeterReading");
const MaintenanceRequest = require("./src/models/MaintenanceRequest");
const Contract = require("./src/models/Contract");
const Room = require("./src/models/Room");

const TENANT_ID = "6a26702c2d0a33dd1c7d761a";

async function removeSeed() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: "SmartBoardingHouse",
  });

  await Payment.deleteMany({ tenant: TENANT_ID });
  await Invoice.deleteMany({ tenant: TENANT_ID });
  await MeterReading.deleteMany({ tenant: TENANT_ID });
  await MaintenanceRequest.deleteMany({ tenant: TENANT_ID });
  await Contract.deleteMany({ tenant: TENANT_ID });

  console.log("Deleted");

  await mongoose.connection.close();
}

removeSeed();
