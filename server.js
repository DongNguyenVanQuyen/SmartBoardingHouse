//server.js
require("dotenv").config();
console.log("Vision key loaded:", !!process.env.GOOGLE_VISION_API_KEY);

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./src/configs/db");
const { specs } = require("./src/configs/swagger");
const firebase = require("./src/configs/firebase");

// Jobs
const { startDebtReminderJob } = require("./src/jobs/debtReminderJob");
const {
  startInvoiceGenerationJob,
} = require("./src/jobs/invoiceGenerationJob");
const { startContractStatusJob } = require("./src/jobs/contractStatusJob");

// Routes
const authRoutes = require("./src/routes/authRoutes.js");
const profileRoutes = require("./src/routes/profileRoutes.js");
const roomRoutes = require("./src/routes/roomRoutes.js");
const contractRoutes = require("./src/routes/contractRoutes.js");
const invoiceRoutes = require("./src/routes/invoiceRoutes.js");
const debtRoutes = require("./src/routes/debtRoutes.js");
const paymentRoutes = require("./src/routes/paymentRoutes.js");
const publicPaymentRoutes = require("./src/routes/publicPaymentRoutes.js");
const meterReadingRoutes = require("./src/routes/meterReadingRoutes.js");
const maintenanceRoutes = require("./src/routes/maintenanceRoutes.js");
const notificationRoutes = require("./src/routes/notificationRoutes.js");
const messageRoutes = require("./src/routes/messageRoutes.js");
const dashboardRoutes = require("./src/routes/dashboardRoutes.js");
const statisticsRoutes = require("./src/routes/statisticsRoutes.js");
const reportRoutes = require("./src/routes/reportRoutes.js");
const internalRoutes = require("./src/routes/internalRoutes.js");
const debugRoutes = require("./src/routes/debugRoutes.js");

const adminRoutes = require("./src/routes/admin.js");

// Sockets
const setupSocket = require("./src/configs/socket");

require("./src/models/Tenant");
require("./src/models/Floor");
require("./src/models/Room");
require("./src/models/Contract");
require("./src/models/Invoice");
require("./src/models/Payment");
require("./src/models/MeterReading");
require("./src/models/MaintenanceRequest");
require("./src/models/Notification");
require("./src/models/Message");

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

setupSocket(io);
app.set("io", io);

// Connect DB
connectDB();
// Firebase Admin
firebase; // Initialize Firebase Admin SDK

// Start scheduled jobs
startDebtReminderJob();
startInvoiceGenerationJob();
startContractStatusJob();

// Middlewares
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger docs
const swaggerUiExpress = require("swagger-ui-express");
app.use(
  "/api-docs",
  [...swaggerUiExpress.serve],
  swaggerUiExpress.setup(specs),
);
// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Tenant App API Running...",
    docs: "/api-docs",
    version: "1.0.0",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/pay", publicPaymentRoutes);
app.use("/api/meter-readings", meterReadingRoutes);
app.use("/api/maintenance-requests", maintenanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", adminRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/debug", debugRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} không tồn tại`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: "Lỗi server", error: err.message });
});



const PORT = process.env.PORT ;
server.listen(PORT, () => {
  console.log(`\nServer running `);
  console.log(`Swagger docs: /api-docs`);
  console.log(`Socket.IO ready\n`);
});