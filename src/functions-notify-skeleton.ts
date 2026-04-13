/*
  Cloud Function skeleton (TypeScript)
  - Place this code under a proper Cloud Functions package (e.g. functions/src/index.ts)
  - Install firebase-admin and firebase-functions in that package and build with tsc
  - This file is intentionally placed at src/functions-notify-skeleton.ts in the repo as a portable artifact
*/

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const notifyOnCreate = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data) return null;

    const title: string = data.title || "Notification";
    const body: string = data.message || "";
    const userId: string | undefined = data.userId;
    const role: string | undefined = data.role;

    try {
      let tokens: string[] = [];

      if (userId) {
        // Find devices owned by this user
        const devicesSnap = await db
          .collection("devices")
          .where("owner", "==", userId)
          .get();
        devicesSnap.forEach((d) => {
          const t = d.data().token;
          if (t) tokens.push(String(t));
        });
      } else if (role) {
        // Find user UIDs with this role, then their devices.
        const usersSnap = await db
          .collection("users")
          .where("role", "==", role)
          .get();
        const uids: string[] = [];
        usersSnap.forEach((u) => uids.push(u.id));

        // Firestore 'in' queries only allow up to 10 items per query. Chunk if necessary.
        for (let i = 0; i < uids.length; i += 10) {
          const chunk = uids.slice(i, i + 10);
          const devicesSnap = await db
            .collection("devices")
            .where("owner", "in", chunk)
            .get();
          devicesSnap.forEach((d) => {
            const t = d.data().token;
            if (t) tokens.push(String(t));
          });
        }
      } else {
        // Broadcast to all devices (use with caution)
        const devicesSnap = await db.collection("devices").get();
        devicesSnap.forEach((d) => {
          const t = d.data().token;
          if (t) tokens.push(String(t));
        });
      }

      // Deduplicate and filter
      tokens = Array.from(new Set(tokens)).filter(Boolean);
      if (tokens.length === 0) {
        console.log(
          "No device tokens found for notification",
          context.params.notificationId,
        );
        return null;
      }

      const payload = {
        notification: { title, body },
        data: {
          notificationId: context.params.notificationId,
          type: data.type || "system",
        },
      };

      const CHUNK = 500; // max tokens per sendMulticast
      for (let i = 0; i < tokens.length; i += CHUNK) {
        const chunk = tokens.slice(i, i + CHUNK);
        const resp = await admin
          .messaging()
          .sendMulticast({ ...payload, tokens: chunk });
        console.log("FCM chunk sent", {
          success: resp.successCount,
          failure: resp.failureCount,
        });

        if (resp.failureCount && resp.responses) {
          resp.responses.forEach((r, idx) => {
            if (!r.success)
              console.warn("FCM failure for token", chunk[idx], r.error);
          });
        }
      }
    } catch (err) {
      console.error("Error sending push notifications:", err);
    }

    return null;
  });
