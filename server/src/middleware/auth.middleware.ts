import jwt from "jsonwebtoken";
import Admin from "../models/Admin.model.js";

/**
 * verifyAdmin middleware
 * - Validates Bearer token
 * - Handles token expiry properly
 * - Ensures role === admin
 * - Forces re-login after expiry (5–7 hrs)
 */
export const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1️⃣ Token missing
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized: Token missing",
        code: "NO_TOKEN",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // 2️⃣ Token expired or invalid
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Session expired. Please login again.",
          code: "TOKEN_EXPIRED",
        });
      }

      return res.status(401).json({
        message: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    // 3️⃣ Role check (extra safety)
    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Forbidden: Not an admin",
      });
    }

    // 4️⃣ Admin existence check (account deleted / disabled case)
    const admin = await Admin.findById(decoded.id).select("_id email");

    if (!admin) {
      return res.status(401).json({
        message: "Unauthorized: Admin no longer exists",
      });
    }

    // 5️⃣ Attach admin to request
    req.admin = admin;
    req.adminId = admin._id;

    next();
  } catch (err) {
    console.error("verifyAdmin error:", err);
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
};
