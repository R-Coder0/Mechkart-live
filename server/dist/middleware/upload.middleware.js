"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCategoryImage = exports.uploadProductImages = exports.uploadGalleryImages = exports.uploadFeatureImage = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Upload directory (project root ke andar "uploads" folder)
const UPLOAD_DIR = path_1.default.join(process.cwd(), "uploads");
// Ensure uploads folder exists
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
// Storage config
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const baseName = path_1.default
            .basename(file.originalname, ext)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    },
});
// File filter (optional – basic image check)
const fileFilter = (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB per file
    },
});
// Helpers jo routes me use kar sakte ho
// Single image (e.g. featureImage)
exports.uploadFeatureImage = exports.upload.single("featureImage");
// Multiple gallery images
exports.uploadGalleryImages = exports.upload.array("galleryImages", 10);
/**
 * Product images (feature + gallery + variantImages[*])
 *
 * Ab yeh upload.any() use karega, taaki:
 * - featureImage
 * - galleryImages
 * - variantImages[0], variantImages[1], ...
 * sab accept ho sakein without "Unexpected field" error.
 */
exports.uploadProductImages = exports.upload.any();
exports.uploadCategoryImage = exports.upload.single("image");
