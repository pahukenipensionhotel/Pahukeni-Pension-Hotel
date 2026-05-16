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
exports.onFolioUpdate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const email_1 = require("../utils/email");
const pdfGenerator_1 = require("../utils/pdfGenerator");
const db = admin.firestore();
exports.onFolioUpdate = (0, firestore_1.onDocumentUpdated)("folios/{folioId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData)
        return;
    // Check if a new deposit was added
    const beforeDeposits = beforeData.deposits || [];
    const afterDeposits = afterData.deposits || [];
    if (afterDeposits.length > beforeDeposits.length) {
        const newDeposit = afterDeposits[afterDeposits.length - 1];
        const bookingId = afterData.booking_id;
        try {
            // Fetch booking to get guest details
            const bookingSnap = await db.collection("room_bookings").doc(bookingId).get();
            if (!bookingSnap.exists)
                return;
            const bookingData = bookingSnap.data();
            const guestEmail = bookingData.guest_email || bookingData.customer_email;
            const guestName = bookingData.guest_name;
            if (!guestEmail)
                return;
            // Generate PDF Receipt for this specific payment
            const pdfBuffer = await (0, pdfGenerator_1.generateReceiptPDF)({
                receiptNumber: `PAY-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                date: new Date().toLocaleDateString(),
                guestName,
                roomNumber: bookingData.room_number,
                items: [{ description: newDeposit.description || "Advance Payment / Deposit", amount: newDeposit.amount }],
                totalAmount: newDeposit.amount,
            });
            // Send Email
            await (0, email_1.sendEmail)({
                to: guestEmail,
                subject: "Payment Received - Pahukeni Pension Hotel",
                template: email_1.PAYMENT_CONFIRMATION_TEMPLATE,
                context: {
                    guestName,
                    amount: newDeposit.amount.toFixed(2),
                    description: newDeposit.description || "your stay",
                },
                attachments: [
                    {
                        filename: `Payment-Receipt.pdf`,
                        content: pdfBuffer,
                    },
                ],
            });
            console.log(`Payment confirmation email sent to ${guestEmail}`);
        }
        catch (error) {
            console.error("Error in onFolioUpdate trigger:", error);
        }
    }
});
