"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAddress = exports.setDefaultAddress = exports.updateAddress = exports.addAddress = exports.listAddresses = void 0;
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../models/User.model");
const getUserId = (req) => req.user?._id;
const trimStr = (v) => String(v ?? "").trim();
const onlyDigits = (v) => trimStr(v).replace(/\D/g, "");
const userPayload = (u) => ({
    name: String(u?.name || ""),
    email: String(u?.email || ""),
    phone: String(u?.phone || u?.mobile || ""),
});
const ensureOneDefault = (addresses, defaultId) => {
    for (const a of addresses) {
        a.isDefault = String(a._id) === String(defaultId);
    }
};
const sortAddressesDefaultFirst = (addresses) => {
    // default first, then newest first if createdAt exists else keep stable
    return [...(addresses || [])].sort((a, b) => {
        const ad = a?.isDefault ? 1 : 0;
        const bd = b?.isDefault ? 1 : 0;
        if (ad !== bd)
            return bd - ad;
        const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
    });
};
const respond = (res, user, addresses, message, status = 200) => {
    return res.status(status).json({
        message,
        data: {
            user: userPayload(user),
            addresses: sortAddressesDefaultFirst(addresses || []),
        },
    });
};
// optional field for Myntra-style tag
const normalizeAddressType = (v) => {
    const t = trimStr(v).toUpperCase();
    if (t === "HOME" || t === "WORK" || t === "OTHER")
        return t;
    return ""; // keep empty if not provided
};
const validatePhone = (phoneRaw) => {
    const phone = onlyDigits(phoneRaw);
    // India-style 10 digit mobile (you can relax later if needed)
    if (phone.length !== 10)
        return null;
    return phone;
};
const validatePincode = (pinRaw) => {
    const pin = onlyDigits(pinRaw);
    if (pin.length !== 6)
        return null;
    return pin;
};
const listAddresses = async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    const user = await User_model_1.User.findById(userId).select("name email phone mobile addresses").lean();
    if (!user)
        return res.status(404).json({ message: "User not found" });
    const addresses = user?.addresses || [];
    // self-heal default
    const hasDefault = addresses.some((a) => a.isDefault);
    if (!hasDefault && addresses.length) {
        await User_model_1.User.updateOne({ _id: userId, "addresses._id": addresses[0]._id }, { $set: { "addresses.$.isDefault": true } });
        const refreshed = await User_model_1.User.findById(userId).select("name email phone mobile addresses").lean();
        if (!refreshed)
            return res.status(404).json({ message: "User not found" });
        return respond(res, refreshed, refreshed.addresses || [], "Addresses fetched");
    }
    return respond(res, user, addresses, "Addresses fetched");
};
exports.listAddresses = listAddresses;
const addAddress = async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    const fullName = trimStr(req.body.fullName);
    const phone = validatePhone(req.body.phone);
    const pincode = validatePincode(req.body.pincode);
    const state = trimStr(req.body.state);
    const city = trimStr(req.body.city);
    const addressLine1 = trimStr(req.body.addressLine1);
    const addressLine2 = trimStr(req.body.addressLine2);
    const landmark = trimStr(req.body.landmark);
    const addressType = normalizeAddressType(req.body.addressType); // ✅ HOME/WORK/OTHER
    const makeDefault = Boolean(req.body.makeDefault);
    if (!fullName || !phone || !pincode || !state || !city || !addressLine1) {
        return res.status(400).json({
            message: "fullName, valid phone(10 digit), valid pincode(6 digit), state, city, addressLine1 are required",
        });
    }
    const user = await User_model_1.User.findById(userId).select("name email phone mobile addresses");
    if (!user)
        return res.status(404).json({ message: "User not found" });
    const isFirst = (user.addresses?.length || 0) === 0;
    const newAddr = {
        _id: new mongoose_1.Types.ObjectId(),
        fullName,
        phone,
        pincode,
        state,
        city,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        landmark: landmark || undefined,
        addressType: addressType || undefined, // ✅ for badge
        isDefault: isFirst ? true : makeDefault,
        createdAt: new Date(), // ✅ helps sorting (optional)
    };
    // if making default, unset old default
    if (newAddr.isDefault) {
        for (const a of user.addresses)
            a.isDefault = false;
    }
    user.addresses.push(newAddr);
    await user.save();
    return respond(res, user, user.addresses, "Address added", 201);
};
exports.addAddress = addAddress;
const updateAddress = async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    const { addressId } = req.params;
    if (!mongoose_1.Types.ObjectId.isValid(addressId)) {
        return res.status(400).json({ message: "Invalid addressId" });
    }
    const user = await User_model_1.User.findById(userId).select("name email phone mobile addresses");
    if (!user)
        return res.status(404).json({ message: "User not found" });
    const addr = user.addresses.id(addressId);
    if (!addr)
        return res.status(404).json({ message: "Address not found" });
    // update fields if provided
    if (req.body.fullName !== undefined) {
        const v = trimStr(req.body.fullName);
        if (!v)
            return res.status(400).json({ message: "fullName cannot be empty" });
        addr.fullName = v;
    }
    if (req.body.phone !== undefined) {
        const v = validatePhone(req.body.phone);
        if (!v)
            return res.status(400).json({ message: "Invalid phone" });
        addr.phone = v;
    }
    if (req.body.pincode !== undefined) {
        const v = validatePincode(req.body.pincode);
        if (!v)
            return res.status(400).json({ message: "Invalid pincode" });
        addr.pincode = v;
    }
    const simple = ["state", "city", "addressLine1", "addressLine2", "landmark"];
    for (const f of simple) {
        if (req.body[f] !== undefined) {
            const v = trimStr(req.body[f]);
            if (["state", "city", "addressLine1"].includes(f) && !v) {
                return res.status(400).json({ message: `${f} cannot be empty` });
            }
            addr[f] = v || undefined;
        }
    }
    if (req.body.addressType !== undefined) {
        const t = normalizeAddressType(req.body.addressType);
        addr.addressType = t || undefined;
    }
    // default handling
    if (req.body.makeDefault === true) {
        ensureOneDefault(user.addresses, addressId);
    }
    await user.save();
    return respond(res, user, user.addresses, "Address updated");
};
exports.updateAddress = updateAddress;
const setDefaultAddress = async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    const { addressId } = req.params;
    if (!mongoose_1.Types.ObjectId.isValid(addressId)) {
        return res.status(400).json({ message: "Invalid addressId" });
    }
    const user = await User_model_1.User.findById(userId).select("name email phone mobile addresses");
    if (!user)
        return res.status(404).json({ message: "User not found" });
    const addr = user.addresses.id(addressId);
    if (!addr)
        return res.status(404).json({ message: "Address not found" });
    ensureOneDefault(user.addresses, addressId);
    await user.save();
    return respond(res, user, user.addresses, "Default address set");
};
exports.setDefaultAddress = setDefaultAddress;
const deleteAddress = async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    const { addressId } = req.params;
    if (!mongoose_1.Types.ObjectId.isValid(addressId)) {
        return res.status(400).json({ message: "Invalid addressId" });
    }
    const user = await User_model_1.User.findById(userId).select("name email phone mobile addresses");
    if (!user)
        return res.status(404).json({ message: "User not found" });
    const addr = user.addresses.id(addressId);
    if (!addr)
        return res.status(404).json({ message: "Address not found" });
    const wasDefault = Boolean(addr.isDefault);
    addr.deleteOne();
    await user.save();
    // if deleted default, set first remaining as default
    if (wasDefault && user.addresses.length) {
        user.addresses[0].isDefault = true;
        await user.save();
    }
    // safety: ensure at most one default
    const defaults = user.addresses.filter((a) => a.isDefault);
    if (defaults.length > 1) {
        ensureOneDefault(user.addresses, String(defaults[0]._id));
        await user.save();
    }
    return respond(res, user, user.addresses, "Address deleted");
};
exports.deleteAddress = deleteAddress;
