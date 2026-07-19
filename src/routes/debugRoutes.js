const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth"); // đổi tên cho khớp middleware xác thực bạn đang có
const { clearMonthData } = require("../controllers/debugController");

router.post("/clear-month", protect, clearMonthData);

module.exports = router;