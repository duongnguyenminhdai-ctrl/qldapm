const dns = require("dns");
const mongoose = require("mongoose");

/**
 * Một số môi trường Windows từ chối querySrv của Node (ECONNREFUSED).
 * Ép DNS công cộng trước khi mongoose resolve mongodb+srv.
 */
dns.setServers(["8.8.8.8", "1.1.1.1"]);

/**
 * Kết nối MongoDB qua Mongoose bằng process.env.MONGO_URI.
 * Gọi một lần trước khi server.listen.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error(
      "[DB] Thiếu biến môi trường MONGO_URI. Kiểm tra file .env (xem .env.example)."
    );
    throw new Error("MONGO_URI is not defined");
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(
      `✅ MongoDB Connected... Host: ${conn.connection.host} | DB: ${conn.connection.name}`
    );
    return conn;
  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(`   Message: ${error.message}`);
    if (error.name) {
      console.error(`   Name: ${error.name}`);
    }
    if (error.reason) {
      console.error(`   Reason: ${error.reason}`);
    }
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    throw error;
  }
};

module.exports = connectDB;
