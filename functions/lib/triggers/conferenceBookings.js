"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onConferenceBookingUpdate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const email_1 = require("../utils/email");
const pdfGenerator_1 = require("../utils/pdfGenerator");
exports.onConferenceBookingUpdate = (0, firestore_1.onDocumentUpdated)("conference_bookings/{bookingId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData)
        return;
    // Trigger on completion (assuming "Completed" or "Confirmed" -> "Completed" transition)
    // If the status changes to "Completed"
    if (beforeData.status !== "Completed" && afterData.status === "Completed") {
        const guestEmail = afterData.client_email || afterData.customer_email;
        const guestName = afterData.client_name;
        const roomName = afterData.room_name || "Conference Hall";
        const bookingId = event.params.bookingId;
        if (!guestEmail)
            return;
        try {
            // Generate PDF Receipt
            const pdfBuffer = await (0, pdfGenerator_1.generateReceiptPDF)({
                receiptNumber: `CONF-${bookingId.slice(0, 8).toUpperCase()}`,
                date: new Date().toLocaleDateString(),
                guestName,
                items: [
                    { description: `Conference Booking (${roomName})`, amount: afterData.total_price }
                ],
                totalAmount: afterData.total_price,
            });
            // Send Email
            await (0, email_1.sendEmail)({
                to: guestEmail,
                subject: "Thank you for visiting Pahukeni Pension Hotel",
                template: email_1.APPRECIATION_TEMPLATE,
                context: { guestName, roomNumber: roomName },
                attachments: [
                    {
                        filename: `Conference-Receipt.pdf`,
                        content: pdfBuffer,
                    },
                ],
            });
            console.log(`Conference completion email sent to ${guestEmail}`);
        }
        catch (error) {
            console.error("Error in onConferenceBookingUpdate trigger:", error);
        }
    }
});
