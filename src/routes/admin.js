//src/routes/admin.js
const express = require("express");
const router = express.Router();
const Contract = require("../models/Contract");
const { generateInvoice } = require("../services/invoiceService");

router.post("/admin/test/advance-month", async (req, res) => {
  try {
    const contract = await Contract.findOne({
      tenant: req.user._id,
      status: "active",
    });
    if (!contract)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng active của tenant",
      });

    const now = new Date();
    let month = now.getMonth() + 2;
    let year = now.getFullYear();
    if (month > 12) {
      month = 1;
      year++;
    }

    const invoice = await generateInvoice(
      req.user._id,
      contract.room,
      month,
      year,
    );
    res.json({
      success: true,
      message: "Đã tạo hóa đơn tháng test",
      data: invoice,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
