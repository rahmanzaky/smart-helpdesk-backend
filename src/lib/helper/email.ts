import 'dotenv/config';
import nodemailer from "nodemailer";
import axios from "axios";

if (!process.env.FRONTEND_URL) {
  console.warn('WARNING: FRONTEND_URL is not set. Email links will not work correctly.');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationMail(to: string, token: string) {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Capstone Test",
          email: "capstonetest7@gmail.com",
        },
        to: [{ email: to }],
        subject: "Verify your email",
        htmlContent: `
          <p>You can verify your account here: ${process.env.FRONTEND_URL}/verify-email?token=${token}</p><p>Your token: ${token}</p>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY!,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      data: response.data,
      error: null,
    };

  } catch (error) {
    console.error(error);

    return { data: null, error };
  }
  // const { data, error } = await resend.emails.send({
  //   from: 'Acme Test <onboarding@resend.dev>',
  //   to,
  //   subject: 'Verify your email',
  //   html: `<p>You can verify your account here: ${'LINK_TO_VERIFY_FRONTEND'}</p><p>Your token: ${token}</p>`
  // });
  // console.log(process.env.RESEND_API_KEY, data, error)
  // return { data, error };
}

export async function sendResetMail(to: string, token: string, userId: number) {
  const resetUrl = `${process.env.FRONTEND_URL}?action=reset-password&token=${token}&id=${userId}`;
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "SEJAHE Smart Helpdesk",
          email: "capstonetest7@gmail.com",
        },
        to: [{ email: to }],
        subject: "Reset Password - SEJAHE Smart Helpdesk",
        htmlContent: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#004aad;padding:28px 36px;">
      <div style="font-size:20px;font-weight:900;color:#fff;">SEJAHE Smart Helpdesk</div>
      <div style="font-size:12px;color:#bfdbfe;margin-top:4px;">PT. Indonesia Epson Industry</div>
    </div>
    <div style="padding:32px 36px;">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#1a1a2e;">Reset Password Anda</h2>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">Kami menerima permintaan reset password untuk akun <strong>${to}</strong>. Klik tombol di bawah untuk membuat password baru. Link ini berlaku selama <strong>15 menit</strong>.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#004aad;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">Reset Password</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e5e7eb;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;">© SEJAHE · PT. Indonesia Epson Industry</div>
    </div>
  </div>
</body></html>`,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY!,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      data: response.data,
      error: null,
    };
  } catch (error) {
    console.error(error);

    return { data: null, error };
  }
  // const { data, error } = await resend.emails.send({
  //   from: 'Acme Test <onboarding@resend.dev>',
  //   to,
  //   subject: 'Reset Password Verification',
  //   html: `<p>You can reset your password here: ${'LINK_TO_RESET_FRONTEND'}</p><p>Your token: ${token}</p>`
  // });

  // return { data, error };
}

export async function sendSummaryReport(to: string, htmlContent: string) {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Capstone Test",
          email: "capstonetest7@gmail.com",
        },
        to: [{ email: to }],
        subject: "Summary Report",
        htmlContent,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY!,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      data: response.data,
      error: null,
    };
  } catch (error) {
    console.error(error);

    return { data: null, error };
  }
  // const { data, error } = await resend.emails.send({
  //   from: 'Acme Test <onboarding@resend.dev>',
  //   to,
  //   subject: 'Chatbot Summary Report',
  //   html: `<p>theres ${summaryData} logs </p>`
  // });

  // return { data, error };
}