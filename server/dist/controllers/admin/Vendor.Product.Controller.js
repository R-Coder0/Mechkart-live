"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGetVendorProductById = exports.adminRejectVendorProduct = exports.adminApproveVendorProduct = exports.adminListVendorProducts = void 0;
const mongoose_1 = require("mongoose");
const Product_model_1 = require("../../models/Product.model");
/**
 * ADMIN: LIST VENDOR PRODUCTS (PENDING / APPROVED / REJECTED)
 * GET /api/admin/vendor-products?status=PENDING|APPROVED|REJECTED&vendorId=&q=
 */
const adminListVendorProducts = async (req, res, next) => {
    try {
        const { status, vendorId, q } = req.query;
        const filter = {
            ownerType: "VENDOR",
        };
        if (status) {
            filter.approvalStatus = String(status).toUpperCase();
        }
        if (vendorId && mongoose_1.Types.ObjectId.isValid(String(vendorId))) {
            filter.vendorId = new mongoose_1.Types.ObjectId(String(vendorId));
        }
        if (q) {
            const rx = new RegExp(String(q).trim(), "i");
            filter.$or = [{ title: rx }, { slug: rx }, { productId: rx }];
        }
        const products = await Product_model_1.Product.find(filter)
            .populate("vendorId", "company.name company.email email phone status name")
            .populate("category", "name slug")
            .populate("subCategory", "name slug")
            .sort({ createdAt: -1 });
        return res.json({ data: products });
    }
    catch (err) {
        next(err);
    }
};
exports.adminListVendorProducts = adminListVendorProducts;
/**
 * ADMIN: APPROVE VENDOR PRODUCT
 * POST /api/admin/vendor-products/:id/approve
 */
const adminApproveVendorProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        const product = await Product_model_1.Product.findOne({
            _id: id,
            ownerType: "VENDOR",
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        product.approvalStatus = "APPROVED";
        product.isActive = true;
        await product.save();
        return res.json({
            message: "Vendor product approved",
            data: product,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.adminApproveVendorProduct = adminApproveVendorProduct;
/**
 * ADMIN: REJECT VENDOR PRODUCT
 * POST /api/admin/vendor-products/:id/reject
 */
const adminRejectVendorProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        const product = await Product_model_1.Product.findOne({
            _id: id,
            ownerType: "VENDOR",
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        product.approvalStatus = "REJECTED";
        product.isActive = false;
        product.approvalNote = reason || "Rejected by admin";
        await product.save();
        product.rejectReason = reason || "Rejected by admin";
        await product.save();
        return res.json({
            message: "Vendor product rejected",
            data: product,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.adminRejectVendorProduct = adminRejectVendorProduct;
const adminGetVendorProductById = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        const product = await Product_model_1.Product.findOne({ _id: id, ownerType: "VENDOR" })
            .populate("vendorId", "company.name company.email email phone status name")
            .populate("category", "name slug")
            .populate("subCategory", "name slug");
        if (!product)
            return res.status(404).json({ message: "Product not found" });
        return res.json({ data: product });
    }
    catch (err) {
        next(err);
    }
};
exports.adminGetVendorProductById = adminGetVendorProductById;
