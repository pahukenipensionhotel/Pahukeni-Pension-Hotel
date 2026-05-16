import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendEmail, PAYMENT_CONFIRMATION_TEMPLATE } from "../utils/email";
import { generateReceiptPDF } from "../utils/pdfGenerator";

const db = admin.firestore();

export const onFolioUpdate = onDocumentUpdated("folios/{folioId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData) return;

  // Check if a new deposit was added
  const beforeDeposits = beforeData.deposits || [];
  const afterDeposits = afterData.deposits || [];

  if (afterDeposits.length > beforeDeposits.length) {
    const newDeposit = afterDeposits[afterDeposits.length - 1];
    const bookingId = afterData.booking_id;

    try {
      // Fetch booking to get guest details
      const bookingSnap = await db.collection("room_bookings").doc(bookingId).get();
      if (!bookingSnap.exists) return;

      const bookingData = bookingSnap.data()!;
      const guestEmail = bookingData.guest_email || bookingData.customer_email;
      const guestName = bookingData.guest_name;

      if (!guestEmail) return;

      // Generate PDF Receipt for this specific payment
      const pdfBuffer = await generateReceiptPDF({
        receiptNumber: `PAY-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        date: new Date().toLocaleDateString(),
        guestName,
        roomNumber: bookingData.room_number,
        items: [{ description: newDeposit.description || "Advance Payment / Deposit", amount: newDeposit.amount }],
        totalAmount: newDeposit.amount,
      });

      // Send Email
      await sendEmail({
        to: guestEmail,
        subject: "Payment Received - Pahukeni Pension Hotel",
        template: PAYMENT_CONFIRMATION_TEMPLATE,
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
    } catch (error) {
      console.error("Error in onFolioUpdate trigger:", error);
    }
  }
});
