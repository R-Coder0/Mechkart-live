import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Vendor } from "../../models/Vendor.model";
import { sendEmail } from "../../utils/sendEmail";
import { VendorAuthRequest } from "../../middleware/vendor.middleware"; 

// ✅ normalize multer file path to web path
// examples:
//  "C:\\x\\project\\uploads\\abc.png" -> "/uploads/abc.png"
//  "uploads\\abc.png"                -> "/uploads/abc.png"
//  "uploads/abc.png"                 -> "/uploads/abc.png"
const normalizeUploadPath = (p?: string) => {
  if (!p) return "";
  let x = String(p).replace(/\\/g, "/");

  // keep only from /uploads/ onwards if full path
  const idx = x.toLowerCase().lastIndexOf("/uploads/");
  if (idx >= 0) x = x.slice(idx);

  // if it starts with "uploads/" make it "/uploads/..."
  if (x.toLowerCase().startsWith("uploads/")) x = `/${x}`;

  // ensure leading slash
  if (!x.startsWith("/")) x = `/${x}`;

  return x;
};

// ✅ helper to read file path from req.files for both upload.fields and upload.any
const getUploadedFilePath = (req: Request, fieldName: string) => {
  const filesAny = (req as any).files;

  // upload.fields -> req.files is an object: { panImage: [file], qrImage: [file] }
  if (filesAny && !Array.isArray(filesAny)) {
    const f = filesAny?.[fieldName]?.[0];
    return normalizeUploadPath(f?.path);
  }

  // upload.any -> req.files is an array: [{ fieldname, path }, ...]
  if (Array.isArray(filesAny)) {
    const f = filesAny.find((it: any) => it?.fieldname === fieldName);
    return normalizeUploadPath(f?.path);
  }

  return "";
};

const pickVendorSafe = (vendor: any) => {
  if (!vendor) return null;

  return {
    _id: vendor._id,
    status: vendor.status,
    isLoginEnabled: vendor.isLoginEnabled,

    name: vendor.name,
    email: vendor.email,
    phone: vendor.phone,

    kyc: {
      panNumber: vendor?.kyc?.panNumber,
      panImage: vendor?.kyc?.panImage,
    },

    company: {
      name: vendor?.company?.name,
      email: vendor?.company?.email,
      gst: vendor?.company?.gst,
    },

    pickupAddress: vendor?.pickupAddress,

    payment: {
      upiId: vendor?.payment?.upiId,
      bankAccount: vendor?.payment?.bankAccount,
      ifsc: vendor?.payment?.ifsc,
      qrImage: vendor?.payment?.qrImage,
    },

    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
};


// ==============================
// 1️⃣ VENDOR REGISTRATION
// ==============================
export const registerVendor = async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,

      panNumber,
      companyName,
      companyEmail,
      gst,

      pickupName,
      pickupPhone,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupPincode,

      upiId,
      bankAccount,
      ifsc,
    } = req.body;

    // =====================
    // BASIC VALIDATIONS
    // =====================
    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !password ||
      !confirmPassword ||
      !panNumber ||
      !companyName ||
      !companyEmail ||
      !pickupAddress
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // PAN format validation
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(String(panNumber).trim())) {
      return res.status(400).json({ message: "Invalid PAN number" });
    }

    // ✅ files (multer) - normalized
    const panImage = getUploadedFilePath(req, "panImage");
    const qrImage = getUploadedFilePath(req, "qrImage");

    if (!panImage) {
      return res.status(400).json({ message: "PAN image is required" });
    }

    // =====================
    // DUPLICATE CHECK
    // =====================
    const existing = await Vendor.findOne({
      $or: [{ email: String(email).toLowerCase() }, { phone }],
    });

    if (existing) {
      return res.status(400).json({ message: "Vendor already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const vendor = await Vendor.create({
      name: {
        first: firstName,
        last: lastName,
      },
      email: String(email).toLowerCase(),
      phone,
      passwordHash,

      kyc: {
        panNumber,
        panImage, // ✅ "/uploads/...."
      },

      company: {
        name: companyName,
        email: String(companyEmail).toLowerCase(),
        gst,
      },

      pickupAddress: {
        name: pickupName,
        phone: pickupPhone,
        address: pickupAddress,
        city: pickupCity,
        state: pickupState,
        pincode: pickupPincode,
      },

      payment: {
        upiId,
        bankAccount,
        ifsc,
        qrImage: qrImage || undefined, // ✅ "/uploads/...." or empty
      },

      status: "PENDING",
      isLoginEnabled: false,
    });

    // 📧 EMAIL → Vendor (After registration)
    await sendEmail({
      to: vendor.email,
      subject: "Vendor Registration Received",
      html: `
        <p>Hello ${vendor.name.first},</p>
        <p>Your vendor registration has been received.</p>
        <p>Our team will review your details and update you shortly.</p>
        <p><b>Status:</b> Pending Verification</p>
      `,
    });

    return res.status(201).json({
      message: "Vendor registered successfully. Awaiting admin approval.",
    });
  } catch (err) {
    console.error("Vendor register error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ==============================
// 2️⃣ ADMIN → APPROVE VENDOR
// ==============================
export const approveVendor = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    if (vendor.status === "APPROVED") {
      return res.status(400).json({ message: "Vendor already approved" });
    }

    vendor.status = "APPROVED";
    vendor.isLoginEnabled = true;
    vendor.rejectReason = undefined;
    await vendor.save();

    await sendEmail({
      to: vendor.email,
      subject: "Vendor Registration Approved",
      html: `
        <p>Hello ${vendor.name.first},</p>
        <p>Your vendor account has been <b>approved</b>.</p>
        <p>You can now login using the link below:</p>
        <p>
          <a href="${process.env.VENDOR_LOGIN_URL}">
            Login as Vendor
          </a>
        </p>
      `,
    });

    return res.json({ message: "Vendor approved successfully" });
  } catch (err) {
    console.error("Approve vendor error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ==============================
// 3️⃣ ADMIN → REJECT VENDOR
// ==============================
export const rejectVendor = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reject reason is required" });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    if (vendor.status === "REJECTED") {
      return res.status(400).json({ message: "Vendor already rejected" });
    }

    vendor.status = "REJECTED";
    vendor.isLoginEnabled = false;
    vendor.rejectReason = reason;
    await vendor.save();

    await sendEmail({
      to: vendor.email,
      subject: "Vendor Registration Rejected",
      html: `
        <p>Hello ${vendor.name.first},</p>
        <p>Your vendor registration has been <b>rejected</b>.</p>
        <p><b>Reason:</b> ${reason}</p>
        <p>You may re-apply after correcting the details.</p>
      `,
    });

    return res.json({ message: "Vendor rejected successfully" });
  } catch (err) {
    console.error("Reject vendor error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ==============================
// 4️⃣ VENDOR LOGIN
// ==============================
// ==============================
// 4️⃣ VENDOR LOGIN (UPDATED)
// ==============================
export const loginVendor = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // ✅ normalize email for search
    const emailNorm = String(email).toLowerCase().trim();

    const vendor = await Vendor.findOne({ email: emailNorm });
    if (!vendor) return res.status(401).json({ message: "Invalid credentials" });

    if (vendor.status === "REJECTED") {
      return res
        .status(403)
        .json({ message: `Account rejected: ${vendor.rejectReason}` });
    }

    if (vendor.status !== "APPROVED" || !vendor.isLoginEnabled) {
      return res.status(403).json({ message: "Vendor account not approved yet" });
    }

    const isMatch = await bcrypt.compare(password, vendor.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    if (!process.env.VENDOR_JWT_SECRET) {
      throw new Error("VENDOR_JWT_SECRET not configured");
    }

    const token = jwt.sign(
      { vendorId: vendor._id, role: "VENDOR" },
      process.env.VENDOR_JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ company name mapping (DB shows company.name)
    const companyName =
      (vendor as any)?.company?.name ||
      (vendor as any)?.companyName ||
      (vendor as any)?.company?.companyName ||
      "";

    // ✅ Debug logs (terminal)
    console.log("LOGIN email:", emailNorm);
    console.log("LOGIN vendorId:", String(vendor._id));
    console.log("LOGIN vendor.company:", (vendor as any)?.company);
    console.log("LOGIN vendor.companyName:", (vendor as any)?.companyName);
    console.log("LOGIN computed companyName:", companyName);

    return res.json({
      message: "Login successful",
      token,
      vendor: {
        id: vendor._id,
        companyName,
        email: vendor.email,
      },
    });
  } catch (err) {
    console.error("Vendor login error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ==============================
// 5️⃣ ADMIN → LIST VENDORS
// GET /api/admin/vendors?status=PENDING&q=abc&page=1&limit=20
// ==============================
export const adminListVendors = async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || "PENDING").toUpperCase();
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status !== "ALL") filter.status = status;

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { "name.first": rx },
        { "name.last": rx },
        { email: rx },
        { phone: rx },
        { "company.name": rx },
        { "company.email": rx },
        { "kyc.panNumber": rx },
      ];
    }

    const [items, total] = await Promise.all([
      Vendor.find(filter)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(filter),
    ]);

    return res.json({ data: { items, total, page, limit } });
  } catch (err) {
    console.error("adminListVendors error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ==============================
// 6️⃣ ADMIN → GET SINGLE VENDOR DETAILS
// GET /api/admin/vendors/:vendorId
// ==============================
export const adminGetVendor = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId).select("-passwordHash").lean();
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    return res.json({ data: vendor });
  } catch (err) {
    console.error("adminGetVendor error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
// ==============================
// 7️⃣ VENDOR → GET MY PROFILE
// GET /api/vendors/me
// ==============================
export const vendorMe = async (req: Request, res: Response) => {
  try {
    // ✅ vendorAuth middleware sets req.vendor = vendorDoc
    const vendorDoc: any = (req as any).vendor;

    const vendorId = vendorDoc?._id || (req as any)?.vendorId;

    if (!vendorId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const vendor = await Vendor.findById(vendorId).select("-passwordHash").lean();
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    return res.json({ data: pickVendorSafe(vendor) });
  } catch (err) {
    console.error("vendorMe error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
// ✅ Allow vendor to update limited fields (no password, no kyc images here)
export const vendorUpdateMe = async (req: VendorAuthRequest, res: Response) => {
  try {
    // vendorAuth middleware puts full vendor doc on req.vendor
    const vendorId = req.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: "Unauthorized" });

    const {
      // Contact (optional)
      phone,

      // Company
      companyName,
      companyEmail,
      gst,

      // Pickup
      pickupName,
      pickupPhone,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupPincode,

      // Payment (optional)
      upiId,
      bankAccount,
      ifsc,
    } = req.body;

    const update: any = {};

    // ✅ Contact
    if (phone !== undefined) update.phone = String(phone).trim();

    // ✅ Company
    if (
      companyName !== undefined ||
      companyEmail !== undefined ||
      gst !== undefined
    ) {
      update.company = {};
      if (companyName !== undefined) update.company.name = String(companyName).trim();
      if (companyEmail !== undefined) update.company.email = String(companyEmail).toLowerCase().trim();
      if (gst !== undefined) update.company.gst = String(gst).trim();
    }

    // ✅ Pickup Address
    if (
      pickupName !== undefined ||
      pickupPhone !== undefined ||
      pickupAddress !== undefined ||
      pickupCity !== undefined ||
      pickupState !== undefined ||
      pickupPincode !== undefined
    ) {
      update.pickupAddress = {};
      if (pickupName !== undefined) update.pickupAddress.name = String(pickupName).trim();
      if (pickupPhone !== undefined) update.pickupAddress.phone = String(pickupPhone).trim();
      if (pickupAddress !== undefined) update.pickupAddress.address = String(pickupAddress).trim();
      if (pickupCity !== undefined) update.pickupAddress.city = String(pickupCity).trim();
      if (pickupState !== undefined) update.pickupAddress.state = String(pickupState).trim();
      if (pickupPincode !== undefined) update.pickupAddress.pincode = String(pickupPincode).trim();
    }

    // ✅ Payment
    if (
      upiId !== undefined ||
      bankAccount !== undefined ||
      ifsc !== undefined
    ) {
      update.payment = {};
      if (upiId !== undefined) update.payment.upiId = String(upiId).trim();
      if (bankAccount !== undefined) update.payment.bankAccount = String(bankAccount).trim();
      if (ifsc !== undefined) update.payment.ifsc = String(ifsc).trim();
    }

    // If nothing to update
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // ✅ Update with dot-notation to avoid overwriting whole nested objects accidentally
    const setObj: any = {};

    if (update.phone !== undefined) setObj["phone"] = update.phone;

    if (update.company) {
      if (update.company.name !== undefined) setObj["company.name"] = update.company.name;
      if (update.company.email !== undefined) setObj["company.email"] = update.company.email;
      if (update.company.gst !== undefined) setObj["company.gst"] = update.company.gst;
    }

    if (update.pickupAddress) {
      if (update.pickupAddress.name !== undefined) setObj["pickupAddress.name"] = update.pickupAddress.name;
      if (update.pickupAddress.phone !== undefined) setObj["pickupAddress.phone"] = update.pickupAddress.phone;
      if (update.pickupAddress.address !== undefined) setObj["pickupAddress.address"] = update.pickupAddress.address;
      if (update.pickupAddress.city !== undefined) setObj["pickupAddress.city"] = update.pickupAddress.city;
      if (update.pickupAddress.state !== undefined) setObj["pickupAddress.state"] = update.pickupAddress.state;
      if (update.pickupAddress.pincode !== undefined) setObj["pickupAddress.pincode"] = update.pickupAddress.pincode;
    }

    if (update.payment) {
      if (update.payment.upiId !== undefined) setObj["payment.upiId"] = update.payment.upiId;
      if (update.payment.bankAccount !== undefined) setObj["payment.bankAccount"] = update.payment.bankAccount;
      if (update.payment.ifsc !== undefined) setObj["payment.ifsc"] = update.payment.ifsc;
    }

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { $set: setObj },
      { new: true }
    )
      .select("-passwordHash")
      .lean();

    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    return res.json({ data: vendor });
  } catch (err) {
    console.error("vendorUpdateMe error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
// PATCH /api/vendors/me/password
export const vendorChangePassword = async (req: Request, res: Response) => {
  try {
    const vendorDoc = (req as any).vendor; // from vendorAuth middleware
    if (!vendorDoc?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const vendor = await Vendor.findById(vendorDoc._id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const ok = await bcrypt.compare(String(currentPassword), vendor.passwordHash);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });

    const newHash = await bcrypt.hash(String(newPassword), 10);
    vendor.passwordHash = newHash;
    await vendor.save();

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("vendorChangePassword error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const adminDisableVendor = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body || {};

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    vendor.status = "DISABLED";
    vendor.isLoginEnabled = false;
    vendor.disabledAt = new Date();
    vendor.disabledReason = reason || "Disabled by admin";

    await vendor.save();

    return res.json({ message: "Vendor disabled successfully" });
  } catch (err) {
    console.error("adminDisableVendor error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const adminEnableVendor = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    vendor.status = "APPROVED";
    vendor.isLoginEnabled = true;
    vendor.disabledAt = undefined;
    vendor.disabledReason = undefined;

    await vendor.save();

    return res.json({ message: "Vendor enabled successfully" });
  } catch (err) {
    console.error("adminEnableVendor error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
// ==============================
// ADMIN → DELETE VENDOR (HARD)
// ==============================
export const adminDeleteVendor = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    await Vendor.findByIdAndDelete(vendorId);

    return res.json({ message: "Vendor deleted permanently" });
  } catch (err) {
    console.error("adminDeleteVendor error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

