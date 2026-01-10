import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User } from "../models/User.model";

type JwtPayload = {
  id: string;
  role: "user";
  iat?: number;
  exp?: number;
};

export const verifyUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token =
      (req as any).cookies?.user_token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server misconfigured: JWT_SECRET missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    if (!decoded?.id || decoded.role !== "user") {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    // attach for downstream controllers
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
