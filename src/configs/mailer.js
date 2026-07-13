// src/configs/mailer.js
const SibApiV3Sdk = require("@getbrevo/brevo");

console.log(
  "BREVO API Key:",
  process.env.BREVO_API_KEY ? "Loaded" : "Not Loaded",
);
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY,
);

const sendOtpEmail = async (toEmail, otp) => {
  const email = new SibApiV3Sdk.SendSmtpEmail();

  email.sender = { name: "SmartBoardingHouse", email: process.env.MAIL_FROM }; // vd: dnvq2911@gmail.com (email đã verify)
  email.to = [{ email: toEmail }];
  email.subject = "Mã OTP đặt lại mật khẩu";
  email.htmlContent = `
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
  `;

  try {
    const result = await apiInstance.sendTransacEmail(email);
    return result;
  } catch (error) {
    console.error("===== BREVO ERROR =====");
    console.error(error.response?.body || error);
    console.error("========================");
    throw error;
  }
};

module.exports = { sendOtpEmail };
