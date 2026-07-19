const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { clearMonthData } = require("../controllers/debugController");

router.post("/clear-month", protect, clearMonthData);

module.exports = router;