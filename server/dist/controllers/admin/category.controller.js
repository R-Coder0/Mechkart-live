"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.getCategoryById = exports.getAllCategories = exports.createCategory = void 0;
const Category_model_js_1 = require("../../models/Category.model.js");
const mongoose_1 = require("mongoose");
const makeSlug = (name) => name
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
/**
 * IMPORTANT:
 * DB me filesystem path (C:\... or /home/...) save mat karo.
 * Web path save karo so that frontend can load it via /uploads/<filename>
 */
const imagePathToStore = (req) => {
    const file = req.file;
    if (!file)
        return "";
    // multer diskStorage gives filename always
    return `/uploads/${file.filename}`;
};
const createCategory = async (req, res, next) => {
    try {
        const { name, description, parentCategory } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Category name is required" });
        }
        const slug = makeSlug(name);
        // unique name or slug check
        const existing = await Category_model_js_1.Category.findOne({
            $or: [{ name }, { slug }],
        });
        if (existing) {
            return res
                .status(409)
                .json({ message: "Category with same name/slug already exists" });
        }
        let parentId = null;
        if (parentCategory) {
            if (!mongoose_1.Types.ObjectId.isValid(parentCategory)) {
                return res.status(400).json({ message: "Invalid parent category id" });
            }
            const parent = await Category_model_js_1.Category.findById(parentCategory);
            if (!parent) {
                return res.status(404).json({ message: "Parent category not found" });
            }
            parentId = parent._id;
        }
        const createdBy = req.admin?._id || null;
        // ✅ category image from multer (field: "image")
        const image = imagePathToStore(req);
        const category = await Category_model_js_1.Category.create({
            name,
            slug,
            description,
            parentCategory: parentId,
            createdBy,
            image,
        });
        return res.status(201).json({
            message: "Category created successfully",
            data: category,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.createCategory = createCategory;
const getAllCategories = async (_req, res, next) => {
    try {
        const categories = await Category_model_js_1.Category.find()
            .populate("parentCategory", "name slug image")
            .sort({ createdAt: -1 });
        return res.status(200).json({
            message: "Categories fetched successfully",
            data: categories,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getAllCategories = getAllCategories;
const getCategoryById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const category = await Category_model_js_1.Category.findById(id).populate("parentCategory", "name slug image");
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        return res.status(200).json({
            message: "Category fetched successfully",
            data: category,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getCategoryById = getCategoryById;
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, parentCategory, isActive } = req.body;
        const category = await Category_model_js_1.Category.findById(id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        // ✅ name + slug update with conflict check (ignore current doc)
        if (name) {
            const newSlug = makeSlug(name);
            const conflict = await Category_model_js_1.Category.findOne({
                _id: { $ne: category._id },
                $or: [{ name }, { slug: newSlug }],
            });
            if (conflict) {
                return res
                    .status(409)
                    .json({ message: "Category with same name/slug already exists" });
            }
            category.name = name;
            category.slug = newSlug;
        }
        if (typeof description !== "undefined") {
            category.description = description;
        }
        if (typeof isActive !== "undefined") {
            category.isActive = isActive;
        }
        if (typeof parentCategory !== "undefined") {
            if (parentCategory === null || parentCategory === "") {
                category.parentCategory = null;
            }
            else {
                if (!mongoose_1.Types.ObjectId.isValid(parentCategory)) {
                    return res
                        .status(400)
                        .json({ message: "Invalid parent category id" });
                }
                if (String(category._id) === String(parentCategory)) {
                    return res
                        .status(400)
                        .json({ message: "Category cannot be parent of itself" });
                }
                const parent = await Category_model_js_1.Category.findById(parentCategory);
                if (!parent) {
                    return res.status(404).json({ message: "Parent category not found" });
                }
                category.parentCategory = parent._id;
            }
        }
        // ✅ update image only if new file uploaded
        const image = imagePathToStore(req);
        if (image) {
            category.image = image;
        }
        await category.save();
        return res.status(200).json({
            message: "Category updated successfully",
            data: category,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const category = await Category_model_js_1.Category.findById(id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        await category.deleteOne();
        return res.status(200).json({ message: "Category deleted successfully" });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteCategory = deleteCategory;
