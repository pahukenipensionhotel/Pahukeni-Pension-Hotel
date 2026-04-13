import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Triggered when a new document is created in the 'notifications' collection.
 * Sends FCM push notifications to target users or roles.
 */
export const notifyOnCreate = onDocumentCreated("notifications/{notificationId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  if (!data) return;

  const title: string = data.title || "Notification";
  const body: string = data.message || "";
  const userId: string | undefined = data.userId;
  const role: string | undefined = data.role;
  const notificationId = event.params.notificationId;

  try {
    let tokens: string[] = [];

    if (userId) {
      // Find devices owned by this specific user
      const devicesSnap = await db.collection("devices").where("owner", "==", userId).get();
      devicesSnap.forEach((d) => {
        const t = d.data().token;
        if (t) tokens.push(String(t));
      });
    } else if (role) {
      // Find all users with this role
      const usersSnap = await db.collection("users").where("role", "==", role).get();
      const uids: string[] = usersSnap.docs.map((doc) => doc.id);

      // Firestore 'in' queries allow up to 30 items (v2) or 10 (v1). Using 10 for safety.
      for (let i = 0; i < uids.length; i += 10) {
        const chunk = uids.slice(i, i + 10);
        const devicesSnap = await db.collection("devices").where("owner", "in", chunk).get();
        devicesSnap.forEach((d) => {
          const t = d.data().token;
          if (t) tokens.push(String(t));
        });
      }
    } else {
      // Broadcast to all devices (use with caution in production)
      const devicesSnap = await db.collection("devices").limit(500).get();
      devicesSnap.forEach((d) => {
        const t = d.data().token;
        if (t) tokens.push(String(t));
      });
    }

    // Deduplicate and filter tokens
    tokens = Array.from(new Set(tokens)).filter((t) => t && t.length > 0);

    if (tokens.length === 0) {
      console.log(`No device tokens found for notification ${notificationId}`);
      return;
    }

    const messagePayload = {
      notification: { title, body },
      data: {
        notificationId: notificationId,
        type: String(data.type || "system"),
      },
    };

    const CHUNK_SIZE = 500;
    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const tokenChunk = tokens.slice(i, i + CHUNK_SIZE);
      const response = await admin.messaging().sendEachForMulticast({
        ...messagePayload,
        tokens: tokenChunk,
      });

      console.log(`FCM batch sent for ${notificationId}: ${response.successCount} success, ${response.failureCount} failure`);

      // Optional: Cleanup invalid tokens
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error?.code === "messaging/invalid-registration-token") {
            const invalidToken = tokenChunk[idx];
            console.log(`Removing invalid token: ${invalidToken}`);
            db.collection("devices").doc(invalidToken).delete().catch(() => {});
          }
        });
      }
    }
  } catch (err) {
    console.error("Error sending push notifications:", err);
  }
});
