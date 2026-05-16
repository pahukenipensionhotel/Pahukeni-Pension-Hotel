import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Export existing triggers
export { notifyOnCreate } from "./triggers/notifications"; // Moving the original logic here for cleanliness

// Export new email triggers
export { onRoomBookingUpdate } from "./triggers/roomBookings";
export { onFolioUpdate } from "./triggers/payments";
export { onConferenceBookingUpdate } from "./triggers/conferenceBookings";
