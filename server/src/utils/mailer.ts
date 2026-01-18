import nodemailer from "nodemailer";

export function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP env missing");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendOtpEmail(to: string, otp: string) {
  const from = process.env.SMTP_FROM || "no-reply@Mechkart.co.in";
  const transporter = createTransport();

  await transporter.sendMail({
    from,
    to,
    subject: "Your OTP for Mechkart Signup",
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
