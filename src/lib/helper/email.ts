import 'dotenv/config';
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendVerificationMail(to: string, token: string) {
  const { data, error } = await resend.emails.send({
    from: 'Acme Test <onboarding@resend.dev>',
    to,
    subject: 'Verify your email',
    html: `<p>You can verify your account here: ${'LINK_TO_VERIFY_FRONTEND'}</p><p>Your token: ${token}</p>`
  });
console.log(process.env.RESEND_API_KEY, data, error)
  return { data, error };
}

export async function sendResetMail(to: string, token: string) {
  const { data, error } = await resend.emails.send({
    from: 'Acme Test <onboarding@resend.dev>',
    to,
    subject: 'Reset Password Verification',
    html: `<p>You can reset your password here: ${'LINK_TO_RESET_FRONTEND'}</p><p>Your token: ${token}</p>`
  });

  return { data, error };
}

export async function sendSummaryReport(to: string, summaryData: any) {
  const { data, error } = await resend.emails.send({
    from: 'Acme Test <onboarding@resend.dev>',
    to,
    subject: 'Chatbot Summary Report',
    html: `<p>theres ${summaryData} logs </p>`
  });

  return { data, error };
}