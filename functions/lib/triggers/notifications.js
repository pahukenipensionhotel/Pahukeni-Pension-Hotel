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
exports.notifyOnCreate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Triggered when a new document is created in the 'notifications' collection.
 * Sends FCM push notifications to target users or roles.
 */
exports.notifyOnCreate = (0, firestore_1.onDocumentCreated)("notifications/{notificationId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    if (!data)
        return;
    const title = data.title || "Notification";
    const body = data.message || "";
    const userId = data.userId;
    const role = data.role;
    const notificationId = event.params.notificationId;
    try {
        let tokens = [];
        if (userId) {
            // Find devices owned by this specific user
            const devicesSnap = await db.collection("devices").where("owner", "==", userId).get();
            devicesSnap.forEach((d) => {
                const t = d.data().token;
                if (t)
                    tokens.push(String(t));
            });
        }
        else if (role) {
            // Find all users with this role
            const usersSnap = await db.collection("users").where("role", "==", role).get();
            const uids = usersSnap.docs.map((doc) => doc.id);
            // Firestore 'in' queries allow up to 30 items (v2) or 10 (v1). Using 10 for safety.
            for (let i = 0; i < uids.length; i += 10) {
                const chunk = uids.slice(i, i + 10);
                const devicesSnap = await db.collection("devices").where("owner", "in", chunk).get();
                devicesSnap.forEach((d) => {
                    const t = d.data().token;
                    if (t)
                        tokens.push(String(t));
                });
            }
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
                        db.collection("devices").doc(invalidToken).delete().catch(() => { });
                    }
                });
            }
        }
    }
    catch (err) {
        console.error("Error sending push notifications:", err);
    }
});
