import multer from "multer";
import path from "path";
import fs from "fs";

// Upload directory (project root ke andar "uploads" folder)
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Storage config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// File filter (optional – basic image check)
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed"));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
  },
});
// ✅ Vendor KYC images (PAN + QR)
export const uploadVendorKyc = upload.fields([
  { name: "panImage", maxCount: 1 },
  { name: "qrImage", maxCount: 1 },
]);

// Helpers jo routes me use kar sakte ho

// Single image (e.g. featureImage)
export const uploadFeatureImage = upload.single("featureImage");

// Multiple gallery images
export const uploadGalleryImages = upload.array("galleryImages", 10);

/**
 * Product images (feature + gallery + variantImages[*])
 *
 * Ab yeh upload.any() use karega, taaki:
 * - featureImage
 * - galleryImages
 * - variantImages[0], variantImages[1], ...
 * sab accept ho sakein without "Unexpected field" error.
 */
export const uploadProductImages = upload.any();
export const uploadCategoryImage = upload.single("image");
// ✅ Return request images (max 5)
export const uploadReturnImages = upload.array("images", 5);
