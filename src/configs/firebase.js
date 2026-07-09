// src/configs/firebase.js
const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

let messaging;

try {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  messaging = getMessaging(app);

  console.log("🔥 Firebase Admin SDK khởi tạo thành công");
  console.log("   Project ID:", process.env.FIREBASE_PROJECT_ID);
} catch (err) {
  console.error("❌ Firebase Admin SDK khởi tạo thất bại:", err.message);
}

module.exports = { messaging };
