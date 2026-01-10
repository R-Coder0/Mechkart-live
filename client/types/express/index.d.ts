import "express";

declare module "express-serve-static-core" {
  interface Request {
    admin?: {
      id: string;
      role: string;
    };
  }
}
