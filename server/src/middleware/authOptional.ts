import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User } from "../models/User.model";

type JwtPayload = { id: string; role: "user" };

export const authOptional = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token =
      (req as any).cookies?.user_token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    if (!decoded?.id || decoded.role !== "user") return next();

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return next();

    (req as any).user = user;
    return next();
  } catch {
    return next();
  }
};
