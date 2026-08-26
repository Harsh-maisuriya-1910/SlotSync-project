import dotenv from "dotenv";

dotenv.config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ACCESS_TOKEN_EXPIRES_IN: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "15m",
  REFRESH_TOKEN_EXPIRES_DAYS: process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7,
  CLIENT_URL: process.env.CLIENT_URL,
  ADMIN_NAME: process.env.ADMIN_NAME,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};

export default env;
