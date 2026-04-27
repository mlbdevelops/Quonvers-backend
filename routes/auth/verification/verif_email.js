import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: `"Quonvers" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Quonvers Verification Code",
    html: `
      <h2>Quonvers Email Verification</h2>
      <p>Your verification code is:</p>
      <h1>${code}</h1>
      <p>Don't share this code.</p>
    `,
  };
  await transporter.sendMail(mailOptions);
}
