import * as nodemailer from "nodemailer";
import * as handlebars from "handlebars";

// Hostinger SMTP settings
const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  subject,
  template,
  context,
  attachments = [],
}: {
  to: string;
  subject: string;
  template: string;
  context: any;
  attachments?: any[];
}) {
  const compiledTemplate = handlebars.compile(template);
  const html = compiledTemplate(context);

  const mailOptions = {
    from: `"Pahukeni Pension Hotel" <${SMTP_USER}>`,
    to,
    subject,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

export const APPRECIATION_TEMPLATE = `
<div style="font-family: serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
  <h2 style="color: #141414; font-style: italic;">Thank you for your stay at Pahukeni Pension Hotel</h2>
  <p>Dear {{guestName}},</p>
  <p>We would like to express our sincere gratitude for choosing Pahukeni Pension Hotel for your recent stay. It was a pleasure having you as our guest.</p>
  <p>We hope you enjoyed our services and had a comfortable stay. We look forward to welcoming you back in the near future.</p>
  <p>Attached to this email, please find your final settlement receipt for Room {{roomNumber}}.</p>
  <p>Your feedback is invaluable to us. For any inconveniences, suggestions, or comments regarding your stay, please feel free to write directly to our reception at <a href="mailto:reception@pahukenipensionhotel.com">reception@pahukenipensionhotel.com</a>.</p>
  <br>
  <p>Best regards,</p>
  <p><strong>The Pahukeni Pension Hotel Team</strong></p>
</div>
`;

export const PAYMENT_CONFIRMATION_TEMPLATE = `
<div style="font-family: serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
  <h2 style="color: #141414; font-style: italic;">Payment Received - Pahukeni Pension Hotel</h2>
  <p>Dear {{guestName}},</p>
  <p>This email is to confirm that we have received your payment of <strong>N$ {{amount}}</strong> for {{description}}.</p>
  <p>Thank you for your prompt payment. Attached is your official receipt for your records.</p>
  <p>We look forward to serving you again.</p>
  <br>
  <p>Best regards,</p>
  <p><strong>The Pahukeni Pension Hotel Team</strong></p>
</div>
`;
