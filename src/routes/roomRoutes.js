//src/routes/roomRoutes.js
// rooms.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { getCurrentRoom } = require("../controllers/roomController");

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Thông tin phòng
 */

/**
 * @swagger
 * /rooms/current:
 *   get:
 *     summary: Xem phòng đang thuê
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: Thông tin phòng, tầng, hợp đồng
 */
router.get("/current", protect, getCurrentRoom);

module.exports = router;
