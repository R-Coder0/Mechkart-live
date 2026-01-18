// src/services/email.service.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

// Sender shown in inbox
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "no-reply@Mechkart.in";

// Owner/Store email (admin/owner notification)
const OWNER_EMAIL = process.env.OWNER_EMAIL || "";

// Optional: turn off emails in dev if you want
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED ?? "true").toLowerCase() === "true";

function assertEnv() {
  if (!EMAIL_ENABLED) return;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Email config missing. Required: SMTP_HOST, SMTP_USER, SMTP_PASS (and SMTP_PORT optional)."
    );
  }
  if (!SMTP_FROM) {
    throw new Error("SMTP_FROM missing");
  }
}

function money(n: any) {
  const val = Math.round(Number(n || 0));
  return `₹${val}`;
}

function escapeHtml(input: any) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

function getTransport() {
  assertEnv();

  // In case you disable emails, still return a dummy object-like
  if (!EMAIL_ENABLED) {
    return null as any;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 => true
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Basic order shape expected by email functions.
 *
 * ✅ We expect `variantText` in items.
 * - Controller MUST save variantText in Order.items at order create time.
 * - Email will show variantText only (never show variantId).
 */
export type EmailOrder = {
  _id?: any;
  orderCode?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  status?: string;
  createdAt?: any;
  totals?: {
    subtotal?: number;
    mrpTotal?: number;
    savings?: number;
  };
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  address?: {
    fullName?: string;
    phone?: string;
    pincode?: string;
    state?: string;
    city?: string;
    addressLine1?: string;
    addressLine2?: string;
    landmark?: string;
  };
  items?: Array<{
    title?: string;
    productCode?: string;
    qty?: number;
    mrp?: number;
    salePrice?: number;
    colorKey?: string | null;

    // kept for DB compatibility (DO NOT show in email)
    variantId?: any;

    // ✅ snapshot variant readable text
    variantText?: string;

    image?: string | null;
  }>;
};

/**
 * Small HTML layout wrapper (simple + reliable)
 */
function wrapHtml(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:720px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e6e8ef;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 20px;background:#111827;color:#fff;">
          <div style="font-size:16px;font-weight:700;">Country Home</div>
          <div style="font-size:12px;opacity:0.85;margin-top:4px;">${escapeHtml(title)}</div>
        </div>
        <div style="padding:18px 20px;color:#111827;">
          ${bodyHtml}
        </div>
        <div style="padding:14px 20px;border-top:1px solid #eef0f5;color:#6b7280;font-size:12px;">
          This is an automated email. Please do not reply.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function buildItemsTable(order: EmailOrder) {
  const items = order.items || [];
  if (!items.length) return "";

  const rows = items
    .map((it) => {
      const title = escapeHtml(it.title || "Product");
      const code = escapeHtml(it.productCode || "—");
      const qty = Number(it.qty || 1);
      const price = money(it.salePrice ?? it.mrp ?? 0);

      const colorVal = safeTrim(it.colorKey);
      const color = colorVal ? ` • Color: ${escapeHtml(colorVal)}` : "";

      // ✅ Variant text ONLY (never show variantId)
      const vText = safeTrim(it.variantText);
      const variant = vText ? ` • Variant: ${escapeHtml(vText)}` : "";

      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eef0f5;">
          <div style="font-weight:700;">${title}</div>
          <div style="font-size:12px;color:#6b7280;">Code: ${code}${color}${variant}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eef0f5;text-align:center;">${qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eef0f5;text-align:right;">${price}</td>
      </tr>`;
    })
    .join("");

  return `
    <div style="margin-top:14px;">
      <div style="font-weight:700;margin-bottom:8px;">Items</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;color:#374151;">Product</th>
            <th style="text-align:center;padding:8px;border-bottom:1px solid #e5e7eb;color:#374151;">Qty</th>
            <th style="text-align:right;padding:8px;border-bottom:1px solid #e5e7eb;color:#374151;">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildAddressBlock(order: EmailOrder) {
  const a = order.address;
  if (!a) return "";
  const line2 = a.addressLine2 ? `, ${escapeHtml(a.addressLine2)}` : "";
  const lm = a.landmark ? `, ${escapeHtml(a.landmark)}` : "";
  return `
    <div style="margin-top:14px;">
      <div style="font-weight:700;margin-bottom:6px;">Delivery Address</div>
      <div style="font-size:13px;color:#374151;line-height:1.6;">
        <div style="font-weight:700;">${escapeHtml(a.fullName || "—")}</div>
        <div>${escapeHtml(a.addressLine1 || "")}${line2}${lm}</div>
        <div>${escapeHtml(a.city || "")}, ${escapeHtml(a.state || "")} - ${escapeHtml(a.pincode || "")}</div>
        <div>Phone: ${escapeHtml(a.phone || "—")}</div>
      </div>
    </div>
  `;
}

function buildTotalsBlock(order: EmailOrder) {
  const t = order.totals || {};
  const subtotal = money(t.subtotal || 0);
  const mrpTotal = money(t.mrpTotal || 0);
  const savings = money(t.savings || 0);

  return `
    <div style="margin-top:14px;">
      <div style="font-weight:700;margin-bottom:6px;">Totals</div>
      <div style="font-size:13px;color:#374151;line-height:1.8;">
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span>Subtotal</span><span style="font-weight:700;">${subtotal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span>MRP Total</span><span>${mrpTotal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span>You Save</span><span style="color:#059669;font-weight:700;">${savings}</span>
        </div>
      </div>
    </div>
  `;
}

function subjectForOrderPlaced(order: EmailOrder) {
  const code = order.orderCode ? ` ${order.orderCode}` : "";
  return `Order Placed${code} | Country Home`;
}

function subjectForOwnerNewOrder(order: EmailOrder) {
  const code = order.orderCode ? ` ${order.orderCode}` : "";
  return `New Order${code} | Country Home`;
}

/**
 * ✅ Send email to CUSTOMER when order is placed
 */
export async function sendOrderPlacedCustomerEmail(order: EmailOrder) {
  if (!EMAIL_ENABLED) return { skipped: true };

  const to = safeTrim(order?.contact?.email);
  if (!to) return { skipped: true, reason: "customer email missing" };

  const orderCode = escapeHtml(order.orderCode || "—");
  const name = escapeHtml(order?.contact?.name || "Customer");
  const payment = escapeHtml(`${order.paymentMethod || "COD"} (${order.paymentStatus || "PENDING"})`);
  const status = escapeHtml(order.status || "PLACED");

  const body = `
    <div style="font-size:14px;color:#111827;line-height:1.7;">
      <div style="font-size:16px;font-weight:800;margin-bottom:6px;">Thanks, ${name}.</div>
      <div>Your order has been placed successfully.</div>

      <div style="margin-top:10px;padding:12px;border:1px solid #eef0f5;border-radius:12px;background:#fafafa;">
        <div><b>Order Code:</b> ${orderCode}</div>
        <div><b>Status:</b> ${status}</div>
        <div><b>Payment:</b> ${payment}</div>
      </div>

      ${buildItemsTable(order)}
      ${buildTotalsBlock(order)}
      ${buildAddressBlock(order)}

      <div style="margin-top:16px;font-size:13px;color:#6b7280;">
        You can track order status from your account dashboard.
      </div>
    </div>
  `;

  const transporter = getTransport();
  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: subjectForOrderPlaced(order),
    html: wrapHtml("Order Placed", body),
  });

  return { messageId: info?.messageId };
}

/**
 * ✅ Send email to OWNER when order is placed
 */
export async function sendOrderPlacedOwnerEmail(order: EmailOrder) {
  if (!EMAIL_ENABLED) return { skipped: true };

  const to = safeTrim(OWNER_EMAIL);
  if (!to) return { skipped: true, reason: "OWNER_EMAIL missing" };

  const orderCode = escapeHtml(order.orderCode || "—");
  const customerName = escapeHtml(order?.contact?.name || "—");
  const phone = escapeHtml(order?.contact?.phone || "—");
  const email = escapeHtml(order?.contact?.email || "—");
  const payment = escapeHtml(`${order.paymentMethod || "COD"} (${order.paymentStatus || "PENDING"})`);
  const status = escapeHtml(order.status || "PLACED");

  const body = `
    <div style="font-size:14px;color:#111827;line-height:1.7;">
      <div style="font-size:16px;font-weight:800;margin-bottom:6px;">New order received.</div>

      <div style="margin-top:10px;padding:12px;border:1px solid #eef0f5;border-radius:12px;background:#fafafa;">
        <div><b>Order Code:</b> ${orderCode}</div>
        <div><b>Status:</b> ${status}</div>
        <div><b>Payment:</b> ${payment}</div>
      </div>

      <div style="margin-top:12px;">
        <div style="font-weight:700;margin-bottom:6px;">Customer</div>
        <div style="font-size:13px;color:#374151;line-height:1.6;">
          <div><b>${customerName}</b></div>
          <div>Phone: ${phone}</div>
          <div>Email: ${email}</div>
        </div>
      </div>

      ${buildItemsTable(order)}
      ${buildTotalsBlock(order)}
      ${buildAddressBlock(order)}
    </div>
  `;

  const transporter = getTransport();
  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: subjectForOwnerNewOrder(order),
    html: wrapHtml("New Order Received", body),
  });

  return { messageId: info?.messageId };
}

/**
 * (Optional) quick SMTP verify you can call once at server boot.
 */
export async function verifyEmailTransport() {
  if (!EMAIL_ENABLED) return { skipped: true };

  const transporter = getTransport();
  await transporter.verify();
  return { ok: true };
}
