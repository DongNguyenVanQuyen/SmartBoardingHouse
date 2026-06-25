//seed-data.js
require("dotenv").config();
const mongoose = require("mongoose");

// Import models
const Floor = require("./src/models/Floor");
const Room = require("./src/models/Room");
const Contract = require("./src/models/Contract");
const Invoice = require("./src/models/Invoice");
const Payment = require("./src/models/Payment");
const MeterReading = require("./src/models/MeterReading");
const MaintenanceRequest = require("./src/models/MaintenanceRequest");

const TENANT_ID = "6a26702c2d0a33dd1c7d761a";

async function seedData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    // 1. Create Floor (Tầng 2)
    const floor = await Floor.findOneAndUpdate(
      { floorNumber: 2 },
      {
        name: "Tầng 2",
        floorNumber: 2,
        description: "Tầng thứ hai",
      },
      { upsert: true, new: true },
    );
    console.log("✓ Floor created/updated:", floor._id);

    // 2. Create Room (Phòng 1)
    const room = await Room.findOneAndUpdate(
      { roomNumber: "1" },
      {
        roomNumber: "1",
        floor: floor._id,
        price: 3000000, // 3 triệu/tháng
        area: 25,
        maxOccupants: 2,
        status: "occupied",
        tenant: TENANT_ID,
        amenities: ["wifi", "ac", "parking"],
        description: "Phòng thoáng mát, gần phố",
      },
      { upsert: true, new: true },
    );
    console.log("✓ Room created/updated:", room._id);

    // 3. Create Contract
    const contract = await Contract.findOneAndUpdate(
      {
        tenant: TENANT_ID,
        room: room._id,
      },
      {
        tenant: TENANT_ID,
        room: room._id,
        startDate: new Date("2022-12-01"),
        endDate: new Date("2026-12-01"),
        deposit: 6000000, // 2 tháng
        monthlyRent: 3000000,
        status: "active",
        terms: "Hợp đồng thuê phòng trọ 48 tháng",
        signedDate: new Date("2022-12-01"),
      },
      { upsert: true, new: true },
    );
    console.log("✓ Contract created/updated:", contract._id);

    // 4. Create 48 Invoices (4 năm: 2023-2026)
    const invoices = [];
    for (let year = 2023; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        const dueDate = new Date(year, month - 1, 15);
        const electricCost = 150000 + Math.random() * 100000;
        const waterCost = 80000 + Math.random() * 50000;

        const invoice = await Invoice.findOneAndUpdate(
          {
            tenant: TENANT_ID,
            room: room._id,
            month,
            year,
          },
          {
            tenant: TENANT_ID,
            room: room._id,
            contract: contract._id,
            month,
            year,
            dueDate,
            items: [
              {
                name: "Tiền phòng",
                quantity: 1,
                unitPrice: 3000000,
                total: 3000000,
              },
              {
                name: "Tiền điện",
                quantity: 1,
                unitPrice: electricCost,
                total: Math.round(electricCost),
              },
              {
                name: "Tiền nước",
                quantity: 1,
                unitPrice: waterCost,
                total: Math.round(waterCost),
              },
            ],
            totalAmount: 3000000 + Math.round(electricCost + waterCost),
            paidAmount:
              Math.random() > 0.3
                ? 3000000 + Math.round(electricCost + waterCost)
                : 0,
            status: Math.random() > 0.3 ? "paid" : "unpaid",
            note: `Hóa đơn tháng ${month}/${year}`,
          },
          { upsert: true, new: true },
        );
        invoices.push(invoice);
      }
    }
    console.log(`✓ ${invoices.length} Invoices created/updated`);

    // 5. Create Payments for invoices
    for (const invoice of invoices) {
      if (invoice.status === "paid" && invoice.paidAmount > 0) {
        const payment = await Payment.findOneAndUpdate(
          {
            tenant: TENANT_ID,
            invoice: invoice._id,
          },
          {
            tenant: TENANT_ID,
            invoice: invoice._id,
            amount: invoice.paidAmount,
            method: ["qr", "cash", "transfer"][Math.floor(Math.random() * 3)],
            status: "success",
            transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            qrData: `00020126580010A0000006040010A00000070701210013BID101214350010000000000102090088888888888863042E6B6161`,
            paidAt: new Date(
              invoice.year,
              invoice.month - 1,
              Math.floor(Math.random() * 25) + 1,
            ),
            note: `Thanh toán hóa đơn tháng ${invoice.month}/${invoice.year}`,
          },
          { upsert: true, new: true },
        );
      }
    }
    console.log(`✓ Payments created/updated for paid invoices`);

    // 6. Create MeterReadings (Điện & Nước) for each month
    for (let year = 2023; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        // Electric meter
        const prevElectricReading = 1000 + (year - 2023) * 5000 + month * 200;
        const currentElectricReading =
          prevElectricReading + Math.floor(Math.random() * 300) + 50;

        const electricReading = await MeterReading.findOneAndUpdate(
          {
            tenant: TENANT_ID,
            room: room._id,
            type: "electric",
            month,
            year,
          },
          {
            tenant: TENANT_ID,
            room: room._id,
            type: "electric",
            currentReading: currentElectricReading,
            previousReading: prevElectricReading,
            usage: currentElectricReading - prevElectricReading,
            unitPrice: 3500,
            totalCost: (currentElectricReading - prevElectricReading) * 3500,
            readingDate: new Date(year, month - 1, 15),
            month,
            year,
            isVerified: true,
          },
          { upsert: true, new: true },
        );

        // Water meter
        const prevWaterReading = 100 + (year - 2023) * 400 + month * 30;
        const currentWaterReading =
          prevWaterReading + Math.floor(Math.random() * 50) + 10;

        const waterReading = await MeterReading.findOneAndUpdate(
          {
            tenant: TENANT_ID,
            room: room._id,
            type: "water",
            month,
            year,
          },
          {
            tenant: TENANT_ID,
            room: room._id,
            type: "water",
            currentReading: currentWaterReading,
            previousReading: prevWaterReading,
            usage: currentWaterReading - prevWaterReading,
            unitPrice: 8000,
            totalCost: (currentWaterReading - prevWaterReading) * 8000,
            readingDate: new Date(year, month - 1, 15),
            month,
            year,
            isVerified: true,
          },
          { upsert: true, new: true },
        );
      }
    }
    console.log(`✓ ${24 * 2} MeterReadings created/updated (electric + water)`);

    // 7. Create MaintenanceRequests
    const maintenanceData = [
      {
        title: "Máy lạnh bị lỏm",
        description: "Máy lạnh không chạy được, không ra lạnh",
        priority: "high",
        category: "electrical",
        status: "completed",
      },
      {
        title: "Vòi nước bị chảy",
        description: "Vòi nước ở bồn rửa bị chảy nhỏ",
        priority: "medium",
        category: "plumbing",
        status: "completed",
      },
      {
        title: "Đèn phòng bị hỏng",
        description: "Bóng đèn chính của phòng bị cháy",
        priority: "low",
        category: "electrical",
        status: "completed",
      },
      {
        title: "Ghế xoay bị gãy",
        description: "Chân ghế xoay bị gãy, không ngồi được",
        priority: "medium",
        category: "furniture",
        status: "pending",
      },
    ];

    const maintenanceRequests = [];
    for (let i = 0; i < maintenanceData.length; i++) {
      const maintenance = await MaintenanceRequest.findOneAndUpdate(
        {
          tenant: TENANT_ID,
          title: maintenanceData[i].title,
        },
        {
          tenant: TENANT_ID,
          room: room._id,
          ...maintenanceData[i],
          resolvedAt:
            maintenanceData[i].status === "completed"
              ? new Date(
                  2024,
                  Math.floor(Math.random() * 12),
                  Math.floor(Math.random() * 28) + 1,
                )
              : null,
          adminNote:
            maintenanceData[i].status === "completed"
              ? "Đã sửa xong, kiểm tra lại OK"
              : "Chờ xếp lịch sửa chữa",
        },
        { upsert: true, new: true },
      );
      maintenanceRequests.push(maintenance);
    }
    console.log(
      `✓ ${maintenanceRequests.length} MaintenanceRequests created/updated`,
    );

    console.log("\n✅ Seed data completed successfully!");
    console.log(`
📊 Summary:
- Floor: Tầng 2 (ID: ${floor._id})
- Room: Phòng 1, Tầng 2 (ID: ${room._id})
- Contract: 48 tháng (ID: ${contract._id})
- Invoices: 48 hóa đơn
- Payments: ${invoices.filter((i) => i.status === "paid").length} thanh toán
- MeterReadings: 96 chỉ số (48 tháng x 2 loại)
- MaintenanceRequests: 4 yêu cầu sửa chữa
    `);

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error seeding data:", error.message);
    process.exit(1);
  }
}

seedData();
