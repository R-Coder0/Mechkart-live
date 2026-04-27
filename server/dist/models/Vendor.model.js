"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vendor = void 0;
const mongoose_1 = require("mongoose");
const VendorSchema = new mongoose_1.Schema({
    name: {
        first: { type: String, required: true, trim: true },
        last: { type: String, required: true, trim: true },
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    kyc: {
        panNumber: { type: String, required: true, uppercase: true },
        panImage: { type: String, required: true },
    },
    company: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        gst: { type: String },
    },
    pickupAddress: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
    },
    payment: {
        upiId: { type: String },
        bankAccount: { type: String },
        ifsc: { type: String },
        qrImage: { type: String },
    },
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED", "DISABLED"],
        default: "PENDING",
    },
    rejectReason: { type: String },
    resetPasswordTokenHash: { type: String },
    resetPasswordTokenExpires: { type: Date },
    // ✅ disable fields in schema
    disabledAt: { type: Date },
    disabledReason: { type: String },
    isLoginEnabled: { type: Boolean, default: false },
}, { timestamps: true });
exports.Vendor = (0, mongoose_1.model)("Vendor", VendorSchema);
