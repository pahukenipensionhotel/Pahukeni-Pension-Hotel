import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendEmail, APPRECIATION_TEMPLATE } from "../utils/email";
import { generateReceiptPDF } from "../utils/pdfGenerator";

export const onConferenceBookingUpdate = onDocumentUpdated("conference_bookings/{bookingId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData) return;

  // Trigger on completion (assuming "Completed" or "Confirmed" -> "Completed" transition)
  // If the status changes to "Completed"
  if (beforeData.status !== "Completed" && afterData.status === "Completed") {
    const guestEmail = afterData.client_email || afterData.customer_email;
    const guestName = afterData.client_name;
    const roomName = afterData.room_name || "Conference Hall";
    const bookingId = event.params.bookingId;

    if (!guestEmail) return;

    try {
      // Generate PDF Receipt
      const pdfBuffer = await generateReceiptPDF({
        receiptNumber: `CONF-${bookingId.slice(0, 8).toUpperCase()}`,
        date: new Date().toLocaleDateString(),
        guestName,
        items: [
          { description: `Conference Booking (${roomName})`, amount: afterData.total_price }
        ],
        totalAmount: afterData.total_price,
      });

      // Send Email
      await sendEmail({
        to: guestEmail,
        subject: "Thank you for visiting Pahukeni Pension Hotel",
        template: APPRECIATION_TEMPLATE,
        context: { guestName, roomNumber: roomName },
        attachments: [
          {
            filename: `Conference-Receipt.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      console.log(`Conference completion email sent to ${guestEmail}`);
    } catch (error) {
      console.error("Error in onConferenceBookingUpdate trigger:", error);
    }
  }
});
