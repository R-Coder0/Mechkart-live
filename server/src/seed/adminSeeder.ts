import "dotenv/config";
import bcrypt from "bcrypt";
import connectDB from "../config/db.js";
import Admin from "../models/Admin.model.js";

async function seedAdmin() {
  try {
    await connectDB();

    const email = process.env.ADMIN_EMAIL!;
    const password = process.env.ADMIN_PASSWORD!;

    if (!email || !password)
      throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD missing in .env");

    const exists = await Admin.findOne({ email });

    if (exists) {
      console.log("⚠️ Admin already exists. Skipping seeding...");
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 12);

    await Admin.create({
      email,
      password: hashed
    });

    console.log("✅ Admin created successfully!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Seeder Error:", err);
    process.exit(1);
  }
}

seedAdmin();
