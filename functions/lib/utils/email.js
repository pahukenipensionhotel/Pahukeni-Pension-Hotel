"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_CONFIRMATION_TEMPLATE = exports.APPRECIATION_TEMPLATE = void 0;
exports.sendEmail = sendEmail;
const nodemailer = __importStar(require("nodemailer"));
const handlebars = __importStar(require("handlebars"));
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
async function sendEmail({ to, subject, template, context, attachments = [], }) {
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
    }
    catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}
exports.APPRECIATION_TEMPLATE = `
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
exports.PAYMENT_CONFIRMATION_TEMPLATE = `
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
