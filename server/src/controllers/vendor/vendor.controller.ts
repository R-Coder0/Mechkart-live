import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Vendor } from "../../models/Vendor.model";
import { sendEmail } from "../../utils/sendEmail";

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
    if (!panRegex.test(panNumber)) {
      return res.status(400).json({ message: "Invalid PAN number" });
    }

    // files (multer)
    const panImage = (req.files as any)?.panImage?.[0]?.path;
    const qrImage = (req.files as any)?.qrImage?.[0]?.path;

    if (!panImage) {
      return res.status(400).json({ message: "PAN image is required" });
    }

    // =====================
    // DUPLICATE CHECK
    // =====================
    const existing = await Vendor.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
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
      email: email.toLowerCase(),
      phone,
      passwordHash,

      kyc: {
        panNumber,
        panImage,
      },

      company: {
        name: companyName,
        email: companyEmail.toLowerCase(),
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
        qrImage,
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
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (vendor.status === "APPROVED") {
      return res.status(400).json({ message: "Vendor already approved" });
    }

    vendor.status = "APPROVED";
    vendor.isLoginEnabled = true;
    vendor.rejectReason = undefined;
    await vendor.save();

    // 📧 EMAIL → Vendor (Approved)
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
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (vendor.status === "REJECTED") {
      return res.status(400).json({ message: "Vendor already rejected" });
    }

    vendor.status = "REJECTED";
    vendor.isLoginEnabled = false;
    vendor.rejectReason = reason;
    await vendor.save();

    // 📧 EMAIL → Vendor (Rejected)
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
export const loginVendor = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const vendor = await Vendor.findOne({
      email: email.toLowerCase(),
    });

    if (!vendor) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (vendor.status === "REJECTED") {
      return res.status(403).json({
        message: `Account rejected: ${vendor.rejectReason}`,
      });
    }

    if (vendor.status !== "APPROVED" || !vendor.isLoginEnabled) {
      return res.status(403).json({
        message: "Vendor account not approved yet",
      });
    }

    const isMatch = await bcrypt.compare(password, vendor.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!process.env.VENDOR_JWT_SECRET) {
      throw new Error("VENDOR_JWT_SECRET not configured");
    }

    const token = jwt.sign(
      {
        vendorId: vendor._id,
        role: "VENDOR",
      },
      process.env.VENDOR_JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      message: "Login successful",
      token,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
      },
    });
  } catch (err) {
    console.error("Vendor login error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
