import nodemailer from 'nodemailer';

const DEV_HOSTS = ['smtp.example.com', 'example.com', ''];

function isDevEmail(): boolean {
  const host = process.env.EMAIL_HOST || '';
  return !host || DEV_HOSTS.includes(host);
}

function createTransporter() {
  if (isDevEmail()) return null;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Email mock] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: `"BloodConnect" <${process.env.EMAIL_USER}>`, to, subject, html });
    console.log(`[Email sent] To: ${to} | Subject: ${subject}`);
  } catch (err) {
    console.error(`[Email error] To: ${to} | Error:`, err);
    throw err;
  }
}
