const nodemailer = require("nodemailer");

/**
 * Khởi tạo Transporter Nodemailer sử dụng Gmail App Password.
 * Cấu hình connectionTimeout và socketTimeout ngắn (8s) để không bị treo vĩnh viễn trên Cloud (Render Free chặn SMTP).
 */
const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  // Loại bỏ khoảng trắng trong App Password phòng trường hợp copy-paste chứa dấu cách
  const pass = process.env.EMAIL_APP_PASSWORD
    ? process.env.EMAIL_APP_PASSWORD.replace(/\s+/g, "")
    : "";

  if (!user || !pass) {
    console.warn(
      "[Mailer] Cảnh báo: Chưa cấu hình EMAIL_USER hoặc EMAIL_APP_PASSWORD trong .env"
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
    connectionTimeout: 8000, // 8 giây - chống treo request trên Cloud
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
};

/**
 * Gửi email qua HTTP REST API của Resend (cổng 443 HTTPS - không bao giờ bị Cloud/Render chặn)
 */
const sendViaResend = async ({ to, subject, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.RESEND_FROM || "Virtual Study Room <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: senderEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API trả về lỗi (${res.status}): ${errText}`);
  }

  const data = await res.json();
  console.log(`[Mailer:Resend] Đã gửi OTP thành công tới ${to} (id: ${data?.id})`);
  return data;
};

/**
 * Gửi email qua HTTP REST API của Brevo / Sendinblue (cổng 443 HTTPS - miễn phí 300 mail/ngày tới mọi email)
 */
const sendViaBrevo = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_USER || "nguyenminhdaiduongtest1@gmail.com";
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Virtual Study Room", email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo API trả về lỗi (${res.status}): ${errText}`);
  }

  const data = await res.json();
  console.log(`[Mailer:Brevo] Đã gửi OTP thành công tới ${to} (messageId: ${data?.messageId})`);
  return data;
};

const escapeHtml = (str) =>
  String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/**
 * Template email HTML cao cấp theo phong cách Zinc / Dark Minimalist
 */
const generateEmailTemplate = ({ title, preheader, name, otp, instruction, note }) => {
  const safeName = escapeHtml(name || "bạn");
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #f4f4f5;">
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">
    ${preheader}
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; border-bottom: 1px solid #27272a; background: linear-gradient(180deg, #18181b 0%, #121215 100%);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; vertical-align: middle;">
                      <span style="display: inline-block; width: 32px; height: 32px; line-height: 32px; text-align: center; background-color: #581c87; color: #c084fc; border: 1px solid #7e22ce; border-radius: 8px; font-weight: bold; font-size: 13px;">VSR</span>
                    </div>
                    <div style="display: inline-block; vertical-align: middle; margin-left: 10px;">
                      <span style="font-size: 15px; font-weight: 700; color: #fafafa; display: block; letter-spacing: -0.3px;">Virtual Study Room</span>
                      <span style="font-size: 11px; color: #a1a1aa; font-family: monospace;">BẢO MẬT & XÁC THỰC</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.4px;">
                ${title}
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Xin chào <strong style="color: #e4e4e7;">${safeName}</strong>,<br/>
                ${instruction}
              </p>

              <!-- OTP Display Box -->
              <div style="margin: 28px 0; padding: 24px 20px; background-color: #18181b; border: 1px dashed #3f3f46; border-radius: 12px; text-align: center;">
                <div style="font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Mã xác thực 6 chữ số</div>
                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #c084fc; padding: 4px 0;">
                  ${otp}
                </div>
                <div style="font-size: 12px; color: #a1a1aa; margin-top: 10px;">
                  ⏱ Hiệu lực trong vòng <strong>5 phút</strong>
                </div>
              </div>

              <!-- Note / Warning -->
              <div style="background-color: #18181b; border-left: 3px solid #a855f7; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #d4d4d8;">
                  ${note || "Tuyệt đối không cung cấp mã xác nhận này cho bất kỳ ai để đảm bảo an toàn tài khoản."}
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #71717a;">
                Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ hỗ trợ.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #27272a; background-color: #0e0e11; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #52525b; line-height: 1.5;">
                © ${new Date().getFullYear()} Virtual Study Room. Hệ thống phòng học nhóm trực tuyến thông minh.<br/>
                Email này được gửi tự động, vui lòng không phản hồi trực tiếp.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Gửi email OTP xác thực tài khoản / đặt lại mật khẩu.
 * @param {object} params
 * @param {string} params.email - Email người nhận
 * @param {string} params.otp - Mã OTP 6 chữ số
 * @param {'REGISTER'|'RESET_PASSWORD'} params.type - Loại thao tác
 * @param {string} [params.name] - Tên người dùng
 */
const sendOtpEmail = async ({ email, otp, type, name = "" }) => {
  let subject = "";
  let title = "";
  let preheader = "";
  let instruction = "";
  let note = "";

  if (type === "REGISTER") {
    subject = `[Virtual Study Room] ${otp} là mã xác thực đăng ký tài khoản của bạn`;
    title = "Xác thực tài khoản mới";
    preheader = `Mã xác thực đăng ký tài khoản Virtual Study Room của bạn là: ${otp}`;
    instruction =
      "Cảm ơn bạn đã tham gia Virtual Study Room! Hãy nhập mã xác thực OTP 6 số bên dưới để hoàn tất việc đăng ký tài khoản.";
    note =
      "Mã xác thực có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.";
  } else if (type === "RESET_PASSWORD") {
    subject = `[Virtual Study Room] ${otp} là mã xác nhận đặt lại mật khẩu của bạn`;
    title = "Yêu cầu đặt lại mật khẩu";
    preheader = `Mã xác nhận đặt lại mật khẩu Virtual Study Room của bạn là: ${otp}`;
    instruction =
      "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Virtual Study Room liên kết với email này. Vui lòng nhập mã OTP bên dưới để tiếp tục:";
    note =
      "Nếu bạn không yêu cầu đặt lại mật khẩu, tài khoản của bạn vẫn an toàn và bạn có thể bỏ qua thông báo này.";
  } else {
    subject = `[Virtual Study Room] Mã xác thực OTP: ${otp}`;
    title = "Mã xác thực OTP";
    preheader = `Mã xác thực của bạn là: ${otp}`;
    instruction = "Vui lòng nhập mã xác thực dưới đây:";
  }

  const html = generateEmailTemplate({
    title,
    preheader,
    name,
    otp,
    instruction,
    note,
  });

  // Ưu tiên 1: Dùng Resend HTTP API nếu có RESEND_API_KEY (không bao giờ bị Render chặn)
  if (process.env.RESEND_API_KEY) {
    return await sendViaResend({ to: email, subject, html });
  }

  // Ưu tiên 2: Dùng Brevo HTTP API nếu có BREVO_API_KEY (miễn phí 300 mail/ngày, port 443)
  if (process.env.BREVO_API_KEY) {
    return await sendViaBrevo({ to: email, subject, html });
  }

  // Ưu tiên 3: Nodemailer Gmail SMTP (cho Local hoặc Host cho phép cổng 465/587)
  const transporter = getTransporter();
  const mailOptions = {
    from: `"Virtual Study Room" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Mailer:Nodemailer] Đã gửi OTP (${type}) tới ${email}: messageId=${info.messageId}`);
  return info;
};

module.exports = {
  sendOtpEmail,
};
