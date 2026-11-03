
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createSuperAdmin() {
  try {
    if (
      !process.env.SUPERADMIN_EMAIL ||
      !process.env.SUPERADMIN_PASSWORD ||
      !process.env.JWT_SECRET
    ) {
      throw new Error("Missing required environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const existing = await User.findOne({
      email: process.env.SUPERADMIN_EMAIL.toLowerCase()
    });

    if (existing) {
      console.log("This email already exists. No account created.");
      return;
    }

    const password = process.env.SUPERADMIN_PASSWORD;

    if (password.length < 12) {
      throw new Error("Use a Super Admin password of at least 12 characters");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: process.env.SUPERADMIN_NAME || "System Owner",
      email: process.env.SUPERADMIN_EMAIL,
      password: hashedPassword,
      role: "superadmin"
    });

    console.log("Super Admin created successfully!");
  } catch (error) {
    console.error("Setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

createSuperAdmin();
