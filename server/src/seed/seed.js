import connectDB from "../config/db.js";

import User from "../modules/users/user.model.js";

import ROLES from "../constants/roles.js";

import env from "../config/env.js";

const seedAdmin = async () => {
  try {
    await connectDB();

    console.log("Database connected");

    const existingAdmin = await User.findOne({
      email: env.ADMIN_EMAIL,
    });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    await User.create({
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
      role: ROLES.ADMIN,
    });

    console.log("Admin created successfully");

    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
};

seedAdmin();
