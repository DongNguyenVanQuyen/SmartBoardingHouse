// backfill_contract_field.js
//
// ⚠️ VÌ SAO CẦN SCRIPT NÀY:
// invoiceService.generateInvoice() giờ khớp/tách hóa đơn theo `contract`
// (Invoice.contract) thay vì chỉ theo (tenant, room, month, year). Field
// `contract` trên Invoice và MeterReading là optional (để không phá dữ liệu
// cũ), nên các bản ghi được TẠO TRƯỚC KHI có field này (trước khi tenant có
// hợp đồng thứ 2) sẽ có contract = null/undefined.
//
// Hệ quả: với tenant thuê từ 2 phòng trở lên mà có dữ liệu cũ kiểu này,
// generateInvoice() sẽ KHÔNG tìm thấy invoice cũ (vì query lọc theo
// contract=<id>) → tạo thêm 1 invoice MỚI trùng tháng/phòng, dẫn tới
// tenant thấy 2 hóa đơn cho cùng 1 tháng/phòng ("lỗi khi có 2 phòng trở lên").
//
// Script này gán lại `contract` cho các Invoice/MeterReading còn thiếu, dựa
// vào hợp đồng khớp (tenant + room, ưu tiên hợp đồng active, fallback hợp
// đồng có startDate/endDate bao trùm thời điểm invoice/reading đó).
//
// CÁCH CHẠY:
//   node backfill_contract_field.js            (mặc định: chỉ xem trước — dry run)
//   node backfill_contract_field.js --apply     (thực sự ghi vào DB)

require("dotenv").config();
const mongoose = require("mongoose");

const Invoice = require("./src/models/Invoice");
const MeterReading = require("./src/models/MeterReading");
const Contract = require("./src/models/Contract");

const APPLY = process.argv.includes("--apply");

// Tìm hợp đồng phù hợp nhất cho 1 bản ghi (tenant, room, month, year) thiếu
// contract: ưu tiên hợp đồng active của đúng tenant+room; nếu không có, lấy
// hợp đồng có khoảng [startDate, endDate] bao trùm ngày 15 của tháng/năm đó
// (ngày cron sinh hóa đơn hàng tháng); nếu vẫn không có, lấy hợp đồng mới
// nhất khớp tenant+room (kể cả đã kết thúc) để không bỏ sót.
async function resolveContractFor(tenantId, roomId, month, year, contractCache) {
  const cacheKey = String(tenantId) + ":" + String(roomId);
  let candidates = contractCache.get(cacheKey);
  if (!candidates) {
    candidates = await Contract.find({ tenant: tenantId, room: roomId }).sort({
      createdAt: -1,
    });
    contractCache.set(cacheKey, candidates);
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const active = candidates.find((c) => c.status === "active");
  if (active) return active;

  const refDate = new Date(year, month - 1, 15);
  const covering = candidates.find(
    (c) =>
      (!c.startDate || c.startDate <= refDate) &&
      (!c.endDate || c.endDate >= refDate),
  );
  if (covering) return covering;

  return candidates[0]; // fallback: mới nhất
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "SmartBoardingHouse" });
  console.log("MongoDB Connected —", APPLY ? "APPLY MODE" : "DRY RUN (thêm --apply để ghi thật)");

  const contractCache = new Map();
  const stats = { invoiceMatched: 0, invoiceAmbiguous: 0, meterMatched: 0, meterAmbiguous: 0 };

  // ── Invoice thiếu contract ──────────────────────────────────────────────
  const invoices = await Invoice.find({
    $or: [{ contract: null }, { contract: { $exists: false } }],
  });
  console.log(`\nInvoice thiếu contract: ${invoices.length}`);

  for (const inv of invoices) {
    const contract = await resolveContractFor(inv.tenant, inv.room, inv.month, inv.year, contractCache);
    const allForTenantRoom = contractCache.get(String(inv.tenant) + ":" + String(inv.room)) || [];

    if (!contract) {
      console.log(`  [BỎ QUA] Invoice ${inv._id} (${inv.invoiceNumber}) — không tìm thấy hợp đồng khớp tenant+room`);
      continue;
    }
    if (allForTenantRoom.length > 1) stats.invoiceAmbiguous++;

    console.log(
      `  Invoice ${inv._id} (${inv.invoiceNumber}, ${inv.month}/${inv.year}) -> contract ${contract._id} (${contract.contractNumber || ""})`,
    );
    stats.invoiceMatched++;
    if (APPLY) {
      inv.contract = contract._id;
      await inv.save();
    }
  }

  // ── MeterReading thiếu contract ─────────────────────────────────────────
  const readings = await MeterReading.find({
    $or: [{ contract: null }, { contract: { $exists: false } }],
  });
  console.log(`\nMeterReading thiếu contract: ${readings.length}`);

  for (const r of readings) {
    const contract = await resolveContractFor(r.tenant, r.room, r.month, r.year, contractCache);
    const allForTenantRoom = contractCache.get(String(r.tenant) + ":" + String(r.room)) || [];

    if (!contract) {
      console.log(`  [BỎ QUA] MeterReading ${r._id} (${r.type}, ${r.month}/${r.year}) — không tìm thấy hợp đồng khớp`);
      continue;
    }
    if (allForTenantRoom.length > 1) stats.meterAmbiguous++;

    stats.meterMatched++;
    if (APPLY) {
      r.contract = contract._id;
      await r.save();
    }
  }

  console.log("\n===== TỔNG KẾT =====");
  console.log(`Invoice đã gán contract       : ${stats.invoiceMatched} (trong đó ${stats.invoiceAmbiguous} tenant+room có >1 hợp đồng — cần kiểm tra lại tay nếu nghi ngờ)`);
  console.log(`MeterReading đã gán contract  : ${stats.meterMatched} (trong đó ${stats.meterAmbiguous} tenant+room có >1 hợp đồng)`);
  console.log(APPLY ? "\nĐã ghi vào DB." : "\nDRY RUN — chưa ghi gì. Chạy lại với --apply để áp dụng thật.");

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});