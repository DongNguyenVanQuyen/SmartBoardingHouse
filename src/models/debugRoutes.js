const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware"); // đổi tên cho khớp middleware xác thực bạn đang có
const { clearMonthData } = require("../controllers/debugController");

router.post("/clear-month", authMiddleware, clearMonthData);

module.exports = router;