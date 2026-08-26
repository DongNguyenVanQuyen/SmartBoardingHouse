# Chi Ti?t ??y ?? C��c API Routes

## File: `admin.js`

- **POST** `/admin/test/advance-month`
  - Handlers: `protect, async (req, res`

## File: `authRoutes.js`

- **POST** `/register`
  - Handlers: `register`
- **POST** `/login`
  - Handlers: `login`
- **POST** `/refresh-token`
  - Handlers: `refreshToken`
- **POST** `/forgot-password`
  - Handlers: `forgotPassword`
- **POST** `/verify-otp`
  - Handlers: `verifyOtpAndResetPassword`
- **PUT** `/change-password`
  - Handlers: `protect, changePassword`
- **POST** `/logout`
  - Handlers: `protect, logout`

## File: `contractRoutes.js`

- **GET** `/`
  - Handlers: `protect, getContracts`
- **GET** `/:id`
  - Handlers: `protect, getContractById`

## File: `dashboardRoutes.js`

- **GET** `/`
  - Handlers: `protect, getDashboard`
- **PATCH** `/select-room`
  - Handlers: `protect, selectDashboardRoom`

## File: `debtRoutes.js`

- **GET** `/`
  - Handlers: `protect, getDebts`
- **GET** `/debug/run-reminder`
  - Handlers: `async (req, res`

## File: `debugRoutes.js`

- **POST** `/clear-month`
  - Handlers: `protect, clearMonthData`

## File: `internalRoutes.js`

- **POST** `/messages/push`
  - Handlers: `internalAuth, pushMessage`
- **POST** `/messages/push-read`
  - Handlers: `internalAuth, pushMessageRead`
- **POST** `/messages/push-conversation-read`
  - Handlers: `internalAuth, pushConversationRead`

## File: `invoiceRoutes.js`

- **GET** `/`
  - Handlers: `protect, getInvoices`
- **GET** `/rooms`
  - Handlers: `protect, getInvoiceRooms`
- **PATCH** `/select-room`
  - Handlers: `protect, selectInvoiceRoom`
- **GET** `/:id`
  - Handlers: `protect, getInvoiceById`

## File: `maintenanceRoutes.js`

- **POST** `/`
  - Handlers: `protect, uploadMaintenance.array("images", 5`
- **GET** `/`
  - Handlers: `protect, getRequests`
- **GET** `/:id`
  - Handlers: `protect, getRequestById`

## File: `messageRoutes.js`

- **GET** `/`
  - Handlers: `protect, getConversations`
- **GET** `/users`
  - Handlers: `protect, getAllUsersForAdmin`
- **GET** `/me`
  - Handlers: `protect, getMyMessages`
- **POST** `/send`
  - Handlers: `protect, sendMessage`
- **GET** `/:tenantId`
  - Handlers: `protect, getMessagesWithTenant`

## File: `meterReadingRoutes.js`

- **GET** `/rooms`
  - Handlers: `protect, getMyMeterRooms`
- **GET** `/previous`
  - Handlers: `protect, getPreviousReading`
- **GET** `/history`
  - Handlers: `protect, getMeterReadingHistory`

## File: `notificationRoutes.js`

- **GET** `/`
  - Handlers: `protect, getNotifications`
- **PUT** `/read`
  - Handlers: `protect, markAsRead`
- **PUT** `/fcm-token`
  - Handlers: `protect, updateFCMToken`

## File: `paymentRoutes.js`

- **POST** `/create-session`
  - Handlers: `protect, createPaymentSession`
- **GET** `/status/:token`
  - Handlers: `protect, getPaymentStatus`
- **GET** `/history`
  - Handlers: `protect, getPaymentHistory`
- **GET** `/pay/:token`
  - Handlers: `renderPaymentPage`
- **POST** `/pay/:token/confirm`
  - Handlers: `confirmPaymentByToken`

## File: `profileRoutes.js`

- **GET** `/`
  - Handlers: `protect, getProfile`
- **PUT** `/`
  - Handlers: `protect, updateProfile`
- **POST** `/avatar`
  - Handlers: `protect, uploadAvatar.single("avatar"`

## File: `publicPaymentRoutes.js`

- **GET** `/:token`
  - Handlers: `renderPaymentPage`
- **POST** `/:token/confirm`
  - Handlers: `uploadReceipt.single("receiptImage"`

## File: `reportRoutes.js`

- **GET** `/monthly`
  - Handlers: `protect, getMonthlyReport`

## File: `roomRoutes.js`

- **GET** `/current`
  - Handlers: `protect, getCurrentRoom`

## File: `statisticsRoutes.js`

- **GET** `/monthly`
  - Handlers: `protect, getMonthlyStatistics`
- **GET** `/yearly`
  - Handlers: `protect, getYearlyStatistics`

