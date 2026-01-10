import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../../models/Admin.model.js";

/**
 * Admin Login
 * - Issues JWT for 6 hours (5–7 hrs requirement)
 * - Returns token + basic admin info
 */
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const admin = await Admin.findOne({ email }).select("+password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ 6 hours session (requirement: 5–7 hours)
    const EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || "6h";

    const token = jwt.sign(
      {
        id: admin._id,
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: EXPIRES_IN }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      expiresIn: EXPIRES_IN, // optional (frontend can use this)
      admin: {
        id: admin._id,
        email: admin.email,
        // name: admin.name,
      },
    });
  } catch (err) {
    console.error("Admin Login Error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

/**
 * Optional: Admin Logout
 * - Since you are using Bearer token in localStorage, logout is client-side.
 * - This endpoint is still useful for consistency.
 */
export const adminLogout = async (req, res) => {
  try {
    return res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.error("Admin Logout Error:", err);
    return res.status(500).json({ message: "Logout failed" });
  }
};

/**
 * Optional: Me (validate token on refresh)
 * - Frontend can call this on admin layout load
 * - If token expired => 401
 */
export const getAdminMe = async (req, res) => {
  try {
    // verifyAdmin middleware should attach req.admin
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json({
      message: "Admin fetched",
      admin: {
        id: admin._id,
        email: admin.email,
        // name: admin.name,
      },
    });
  } catch (err) {
    console.error("Admin Me Error:", err);
    return res.status(500).json({ message: "Failed to fetch admin" });
  }
};
