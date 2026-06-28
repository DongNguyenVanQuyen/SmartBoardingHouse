//src/configs/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "SmartBoardingHouse", // khớp database bên Admin (.NET)
    });

    console.log("MongoDB Connected -> DB:", mongoose.connection.name);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
