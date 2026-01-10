"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransport = createTransport;
exports.sendOtpEmail = sendOtpEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
function createTransport() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
        throw new Error("SMTP env missing");
    }
    return nodemailer_1.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}
async function sendOtpEmail(to, otp) {
    const from = process.env.SMTP_FROM || "no-reply@countryhome.co.in";
    const transporter = createTransport();
    await transporter.sendMail({
        from,
        to,
        subject: "Your OTP for CountryHome Signup",
        text: `Your OTP is ${otp}. It expires in 10 minutes.`,
        html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Verify your email</h2>
        <p>Your OTP is:</p>
        <div style="font-size:22px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p style="color:#555">This OTP expires in 10 minutes.</p>
      </div>
    `,
    });
}
