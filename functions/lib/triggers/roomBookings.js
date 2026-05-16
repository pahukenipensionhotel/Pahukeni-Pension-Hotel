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
exports.onRoomBookingUpdate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const email_1 = require("../utils/email");
const pdfGenerator_1 = require("../utils/pdfGenerator");
const db = admin.firestore();
exports.onRoomBookingUpdate = (0, firestore_1.onDocumentUpdated)("room_bookings/{bookingId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData)
        return;
    // Trigger only on status change to "Checked Out"
    if (beforeData.status !== "Checked Out" && afterData.status === "Checked Out") {
        const guestEmail = afterData.guest_email || afterData.customer_email;
        const guestName = afterData.guest_name;
        const roomNumber = afterData.room_number;
        const bookingId = event.params.bookingId;
        if (!guestEmail) {
            console.log(`No email found for guest ${guestName} (Booking: ${bookingId})`);
            return;
        }
        try {
            // Fetch Folio data for receipt
            const folioSnap = await db.collection("folios").where("booking_id", "==", bookingId).get();
            let items = [
                { description: `Room Stay (Room ${roomNumber})`, amount: afterData.total_price }
            ];
            let totalAmount = afterData.total_price;
            if (!folioSnap.empty) {
                const folioData = folioSnap.docs[0].data();
                if (folioData.charges) {
                    folioData.charges.forEach((charge) => {
                        items.push({ description: charge.description, amount: charge.amount });
                        totalAmount += charge.amount;
                    });
                }
                if (folioData.deposits) {
                    folioData.deposits.forEach((dep) => {
                        // Deposits are usually pre-paid, but we show them on the final receipt
                        // totalAmount already includes room price + extra charges.
                        // We might want to show net balance, but usually, a receipt shows what was paid.
                    });
                }
            }
            // Generate PDF Receipt
            const pdfBuffer = await (0, pdfGenerator_1.generateReceiptPDF)({
                receiptNumber: `REC-${bookingId.slice(0, 8).toUpperCase()}`,
                date: new Date().toLocaleDateString(),
                guestName,
                roomNumber,
                items,
                totalAmount,
            });
            // Send Email
            await (0, email_1.sendEmail)({
                to: guestEmail,
                subject: "Thank you for your stay at Pahukeni Pension Hotel",
                template: email_1.APPRECIATION_TEMPLATE,
                context: { guestName, roomNumber },
                attachments: [
                    {
                        filename: `Receipt-${roomNumber}.pdf`,
                        content: pdfBuffer,
                    },
                ],
            });
            console.log(`Checkout email sent successfully to ${guestEmail}`);
        }
        catch (error) {
            console.error("Error in onRoomBookingUpdate trigger:", error);
        }
    }
});
