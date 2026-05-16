import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendEmail, APPRECIATION_TEMPLATE } from "../utils/email";
import { generateReceiptPDF } from "../utils/pdfGenerator";

const db = admin.firestore();

export const onRoomBookingUpdate = onDocumentUpdated("room_bookings/{bookingId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData) return;

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
      let items: { description: string; amount: number }[] = [
        { description: `Room Stay (Room ${roomNumber})`, amount: afterData.total_price }
      ];
      let totalAmount = afterData.total_price;

      if (!folioSnap.empty) {
        const folioData = folioSnap.docs[0].data();
        if (folioData.charges) {
          folioData.charges.forEach((charge: any) => {
            items.push({ description: charge.description, amount: charge.amount });
            totalAmount += charge.amount;
          });
        }
        if (folioData.deposits) {
          folioData.deposits.forEach((dep: any) => {
            // Deposits are usually pre-paid, but we show them on the final receipt
            // totalAmount already includes room price + extra charges.
            // We might want to show net balance, but usually, a receipt shows what was paid.
          });
        }
      }

      // Generate PDF Receipt
      const pdfBuffer = await generateReceiptPDF({
        receiptNumber: `REC-${bookingId.slice(0, 8).toUpperCase()}`,
        date: new Date().toLocaleDateString(),
        guestName,
        roomNumber,
        items,
        totalAmount,
      });

      // Send Email
      await sendEmail({
        to: guestEmail,
        subject: "Thank you for your stay at Pahukeni Pension Hotel",
        template: APPRECIATION_TEMPLATE,
        context: { guestName, roomNumber },
        attachments: [
          {
            filename: `Receipt-${roomNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      console.log(`Checkout email sent successfully to ${guestEmail}`);
    } catch (error) {
      console.error("Error in onRoomBookingUpdate trigger:", error);
    }
  }
});
