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
    // No-op when EMAIL_HOST is not configured or is a placeholder (dev/test environment)
    console.log(`[Email mock] To: ${to} | Subject: ${subject}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
}
