import 'dotenv/config';
import { Resend } from "resend";
import nodemailer from "nodemailer";
import axios from "axios";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log(process.env.BREVO_API_KEY)

const resend = new Resend(process.env.RESEND_API_KEY!);

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
          <p>Your token: ${token}</p>
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

export async function sendResetMail(to: string, token: string) {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Capstone Test",
          email: "capstonetest7@gmail.com",
        },
        to: [{ email: to }],
        subject: "Reset your password",
        htmlContent: `
          <p>You can reset your password here: ${'LINK_TO_RESET_FRONTEND'}</p><p>Your token: ${token}</p>
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
  //   subject: 'Reset Password Verification',
  //   html: `<p>You can reset your password here: ${'LINK_TO_RESET_FRONTEND'}</p><p>Your token: ${token}</p>`
  // });

  // return { data, error };
}

export async function sendSummaryReport(to: string, summaryData: any) {
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
        htmlContent: `
          <p>theres ${summaryData} logs </p>
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
  //   subject: 'Chatbot Summary Report',
  //   html: `<p>theres ${summaryData} logs </p>`
  // });

  // return { data, error };
}