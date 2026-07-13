// src/configs/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  family: 4, // ép dùng IPv4
});

// Kiểm tra kết nối SMTP khi server khởi động
transporter.verify((err, success) => {
  if (err) {
    console.error("===== MAIL VERIFY ERROR =====");
    console.error(err);
    console.error("=============================");
  } else {
    console.log("✅ Mail server is ready");
  }
});

const sendOtpEmail = async (toEmail, otp) => {
  const mailOptions = {
    from: `"SmartBoardingHouse" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: "Mã OTP đặt lại mật khẩu",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color:#2196F3;">Đặt lại mật khẩu</h2>

        <p>Xin chào,</p>

        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản SmartBoardingHouse.</p>

        <p>Mã OTP của bạn là:</p>

        <div
          style="
            font-size:32px;
            font-weight:bold;
            color:#2196F3;
            letter-spacing:6px;
            margin:20px 0;
          "
        >
          ${otp}
        </div>

        <p>Mã OTP có hiệu lực trong <strong>5 phút</strong>.</p>

        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>

        <hr>

        <small>Email được gửi tự động từ hệ thống SmartBoardingHouse.</small>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = {
  sendOtpEmail,
};
