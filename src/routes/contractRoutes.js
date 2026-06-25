//src/routes/contractRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  getContracts,
  getContractById,
} = require("../controllers/contractController");

/**
 * @swagger
 * tags:
 *   name: Contracts
 *   description: Hợp đồng thuê
 */

/**
 * @swagger
 * /contracts:
 *   get:
 *     summary: Danh sách hợp đồng
 *     tags: [Contracts]
 *     responses:
 *       200:
 *         description: Danh sách hợp đồng
 */
router.get("/", protect, getContracts);

/**
 * @swagger
 * /contracts/{id}:
 *   get:
 *     summary: Chi tiết hợp đồng
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin hợp đồng
 */
router.get("/:id", protect, getContractById);

module.exports = router;
