"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReceiptPDF = generateReceiptPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
async function generateReceiptPDF(data) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: 50 });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));
        // Header
        doc
            .fontSize(20)
            .text("PAHUKENI PENSION HOTEL", { align: "center" })
            .fontSize(10)
            .text("Professional Hospitality Services", { align: "center" })
            .moveDown();
        doc
            .fontSize(16)
            .text("OFFICIAL RECEIPT", { align: "center", underline: true })
            .moveDown();
        // Receipt Info
        doc
            .fontSize(10)
            .text(`Receipt #: ${data.receiptNumber}`)
            .text(`Date: ${data.date}`)
            .moveDown();
        // Guest Info
        doc
            .text(`Guest Name: ${data.guestName}`)
            .text(data.roomNumber ? `Room Number: ${data.roomNumber}` : "")
            .moveDown();
        // Table Header
        const tableTop = 250;
        doc.font("Helvetica-Bold");
        doc.text("Description", 50, tableTop);
        doc.text("Amount (N$)", 400, tableTop, { align: "right" });
        doc.moveDown();
        doc.font("Helvetica");
        // Line
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        // Items
        let currentY = tableTop + 25;
        data.items.forEach((item) => {
            doc.text(item.description, 50, currentY);
            doc.text(item.amount.toFixed(2), 400, currentY, { align: "right" });
            currentY += 20;
        });
        // Total
        doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
        currentY += 10;
        doc.font("Helvetica-Bold");
        doc.text("TOTAL", 50, currentY);
        doc.text(`N$ ${data.totalAmount.toFixed(2)}`, 400, currentY, { align: "right" });
        // Footer
        doc
            .moveDown(4)
            .fontSize(10)
            .font("Helvetica-Oblique")
            .text("Thank you for choosing Pahukeni Pension Hotel.", { align: "center" })
            .text("For any inquiries, contact reception@pahukenipensionhotel.com", { align: "center" });
        doc.end();
    });
}
