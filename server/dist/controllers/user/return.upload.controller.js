"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadReturnImagesController = void 0;
function toPublicUrl(req, filename) {
    // IMPORTANT: server must serve /uploads statically (main server.ts)
    // return "/uploads/<filename>"
    return `/uploads/${filename}`;
}
// POST /api/users/uploads/return-images
const uploadReturnImagesController = async (req, res) => {
    try {
        const files = req.files || [];
        const urls = Array.isArray(files)
            ? files.map((f) => toPublicUrl(req, f.filename)).filter(Boolean)
            : [];
        return res.json({
            message: "Uploaded",
            data: { urls },
        });
    }
    catch (e) {
        return res.status(500).json({ message: "Upload failed", error: e?.message || "Unknown error" });
    }
};
exports.uploadReturnImagesController = uploadReturnImagesController;
