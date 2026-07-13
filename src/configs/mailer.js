// src/configs/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendOtpEmail = async (toEmail, otp) => {
  await transporter.sendMail({
    from: `"SmartBoardingHouse" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: "Mã OTP đặt lại mật khẩu",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Đặt lại mật khẩu</h2>
        <p>Mã OTP của bạn là:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2196F3; margin: 16px 0;">
          ${otp}
        </div>
        <p>Mã có hiệu lực trong 5 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
      </div>
    `,
  });
};

module.exports = { sendOtpEmail };
