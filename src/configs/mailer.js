// src/configs/mailer.js
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOtpEmail = async (toEmail, otp) => {
  const { data, error } = await resend.emails.send({
    from: `"SmartBoardingHouse" <${process.env.MAIL_FROM}>`, // vd: onboarding@resend.dev hoặc noreply@yourdomain.com
    to: toEmail,
    subject: "Mã OTP đặt lại mật khẩu",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color:#2196F3;">Đặt lại mật khẩu</h2>
        <p>Xin chào,</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản SmartBoardingHouse.</p>
        <p>Mã OTP của bạn là:</p>
        <div style="font-size:32px; font-weight:bold; color:#2196F3; letter-spacing:6px; margin:20px 0;">
          ${otp}
        </div>
        <p>Mã OTP có hiệu lực trong <strong>5 phút</strong>.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        <hr>
        <small>Email được gửi tự động từ hệ thống SmartBoardingHouse.</small>
      </div>
    `,
  });

  if (error) {
    console.error("===== RESEND ERROR =====");
    console.error(error);
    console.error("=========================");
    throw error;
  }

  return data;
};

module.exports = { sendOtpEmail };
