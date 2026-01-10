/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../../models/User.model";

const getUserId = (req: Request) => (req as any).user?._id;

const trimStr = (v: any) => String(v ?? "").trim();

const onlyDigits = (v: any) => trimStr(v).replace(/\D/g, "");

const userPayload = (u: any) => ({
  name: String(u?.name || ""),
  email: String(u?.email || ""),
  phone: String(u?.phone || u?.mobile || ""),
});

const ensureOneDefault = (addresses: any[], defaultId: string) => {
  for (const a of addresses) {
    a.isDefault = String(a._id) === String(defaultId);
  }
};

const sortAddressesDefaultFirst = (addresses: any[]) => {
  // default first, then newest first if createdAt exists else keep stable
  return [...(addresses || [])].sort((a: any, b: any) => {
    const ad = a?.isDefault ? 1 : 0;
    const bd = b?.isDefault ? 1 : 0;
    if (ad !== bd) return bd - ad;
    const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
};

const respond = (res: Response, user: any, addresses: any[], message: string, status = 200) => {
  return res.status(status).json({
    message,
    data: {
      user: userPayload(user),
      addresses: sortAddressesDefaultFirst(addresses || []),
    },
  });
};

// optional field for Myntra-style tag
const normalizeAddressType = (v: any) => {
  const t = trimStr(v).toUpperCase();
  if (t === "HOME" || t === "WORK" || t === "OTHER") return t;
  return ""; // keep empty if not provided
};

const validatePhone = (phoneRaw: any) => {
  const phone = onlyDigits(phoneRaw);
  // India-style 10 digit mobile (you can relax later if needed)
  if (phone.length !== 10) return null;
  return phone;
};

const validatePincode = (pinRaw: any) => {
  const pin = onlyDigits(pinRaw);
  if (pin.length !== 6) return null;
  return pin;
};

export const listAddresses = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await User.findById(userId).select("name email phone mobile addresses").lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const addresses = (user as any)?.addresses || [];

  // self-heal default
  const hasDefault = addresses.some((a: any) => a.isDefault);
  if (!hasDefault && addresses.length) {
    await User.updateOne(
      { _id: userId, "addresses._id": addresses[0]._id },
      { $set: { "addresses.$.isDefault": true } }
    );

    const refreshed = await User.findById(userId).select("name email phone mobile addresses").lean();
    if (!refreshed) return res.status(404).json({ message: "User not found" });

    return respond(res, refreshed, (refreshed as any).addresses || [], "Addresses fetched");
  }

  return respond(res, user, addresses, "Addresses fetched");
};

export const addAddress = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

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

  const user = await User.findById(userId).select("name email phone mobile addresses");
  if (!user) return res.status(404).json({ message: "User not found" });

  const isFirst = (user.addresses?.length || 0) === 0;

  const newAddr: any = {
    _id: new Types.ObjectId(),
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
    for (const a of user.addresses as any) a.isDefault = false;
  }

  (user.addresses as any).push(newAddr);
  await user.save();

  return respond(res, user, user.addresses as any, "Address added", 201);
};

export const updateAddress = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { addressId } = req.params;
  if (!Types.ObjectId.isValid(addressId)) {
    return res.status(400).json({ message: "Invalid addressId" });
  }

  const user = await User.findById(userId).select("name email phone mobile addresses");
  if (!user) return res.status(404).json({ message: "User not found" });

  const addr: any = (user.addresses as any).id(addressId);
  if (!addr) return res.status(404).json({ message: "Address not found" });

  // update fields if provided
  if (req.body.fullName !== undefined) {
    const v = trimStr(req.body.fullName);
    if (!v) return res.status(400).json({ message: "fullName cannot be empty" });
    addr.fullName = v;
  }

  if (req.body.phone !== undefined) {
    const v = validatePhone(req.body.phone);
    if (!v) return res.status(400).json({ message: "Invalid phone" });
    addr.phone = v;
  }

  if (req.body.pincode !== undefined) {
    const v = validatePincode(req.body.pincode);
    if (!v) return res.status(400).json({ message: "Invalid pincode" });
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
    ensureOneDefault(user.addresses as any, addressId);
  }

  await user.save();
  return respond(res, user, user.addresses as any, "Address updated");
};

export const setDefaultAddress = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { addressId } = req.params;
  if (!Types.ObjectId.isValid(addressId)) {
    return res.status(400).json({ message: "Invalid addressId" });
  }

  const user = await User.findById(userId).select("name email phone mobile addresses");
  if (!user) return res.status(404).json({ message: "User not found" });

  const addr: any = (user.addresses as any).id(addressId);
  if (!addr) return res.status(404).json({ message: "Address not found" });

  ensureOneDefault(user.addresses as any, addressId);
  await user.save();

  return respond(res, user, user.addresses as any, "Default address set");
};

export const deleteAddress = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { addressId } = req.params;
  if (!Types.ObjectId.isValid(addressId)) {
    return res.status(400).json({ message: "Invalid addressId" });
  }

  const user = await User.findById(userId).select("name email phone mobile addresses");
  if (!user) return res.status(404).json({ message: "User not found" });

  const addr: any = (user.addresses as any).id(addressId);
  if (!addr) return res.status(404).json({ message: "Address not found" });

  const wasDefault = Boolean(addr.isDefault);

  addr.deleteOne();
  await user.save();

  // if deleted default, set first remaining as default
  if (wasDefault && (user.addresses as any).length) {
    (user.addresses as any)[0].isDefault = true;
    await user.save();
  }

  // safety: ensure at most one default
  const defaults = (user.addresses as any).filter((a: any) => a.isDefault);
  if (defaults.length > 1) {
    ensureOneDefault(user.addresses as any, String(defaults[0]._id));
    await user.save();
  }

  return respond(res, user, user.addresses as any, "Address deleted");
};
