/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";

function toPublicUrl(req: Request, filename: string) {
  // IMPORTANT: server must serve /uploads statically (main server.ts)
  // return "/uploads/<filename>"
  return `/uploads/${filename}`;
}

// POST /api/users/uploads/return-images
export const uploadReturnImagesController = async (req: Request, res: Response) => {
  try {
    const files = (req as any).files || [];
    const urls = Array.isArray(files)
      ? files.map((f: any) => toPublicUrl(req, f.filename)).filter(Boolean)
      : [];

    return res.json({
      message: "Uploaded",
      data: { urls },
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Upload failed", error: e?.message || "Unknown error" });
  }
};
