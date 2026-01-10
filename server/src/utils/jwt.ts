import jwt from "jsonwebtoken";

export const signAdminToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
};
