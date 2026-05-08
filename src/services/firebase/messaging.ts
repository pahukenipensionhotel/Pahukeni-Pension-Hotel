import {
  getMessaging,
  getToken,
  onMessage,
  deleteToken,
} from "firebase/messaging";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./client";

const DEFAULT_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let lastSavedToken: string | null = null;
const TOKEN_REFRESH_INTERVAL = 1000 * 60 * 60 * 24 * 7; // Refresh once a week

/**
 * Registers for push notifications and handles token rotation.
 */
export async function registerForPush(vapidKey: string = DEFAULT_VAPID_KEY) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this environment.");
    return null;
  }

  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "denied"
    ) {
      return null;
    }

    // Register service worker from the public root with config params
    const configParams = new URLSearchParams({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId:
        import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
    }).toString();

    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${configParams}`,
    );
    const messaging = getMessaging();

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return null;
    }

    // Attempt to get token
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("No registration token available.");
      return null;
    }

    // Token Rotation Logic: Check if token is old or needs update
    const ownerId = auth.currentUser?.uid;
    const tokenRef = doc(db, "devices", token);
    const tokenDoc = await getDoc(tokenRef);

    let needsUpdate = !tokenDoc.exists();
    if (tokenDoc.exists()) {
      const data = tokenDoc.data();
      const lastUpdated = new Date(
        data.updated_at || data.created_at,
      ).getTime();
      if (Date.now() - lastUpdated > TOKEN_REFRESH_INTERVAL) {
        needsUpdate = true;
      }
    }

    if (needsUpdate || token !== lastSavedToken) {
      await setDoc(
        tokenRef,
        {
          owner: ownerId || null,
          token: token,
          platform: "web",
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
      lastSavedToken = token;
      console.log("FCM Token rotated/updated");
    }

    return token;
  } catch (err) {
    console.error("Failed to register for push:", err);
    return null;
  }
}

/**
 * Forcefully rotates the current FCM token.
 */
export async function rotateFCMToken(vapidKey: string = DEFAULT_VAPID_KEY) {
  try {
    const messaging = getMessaging();
    const currentToken = await getToken(messaging);
    if (currentToken) {
      await deleteToken(messaging);
      console.log("Current token deleted for rotation.");
    }
    return await registerForPush(vapidKey);
  } catch (err) {
    console.error("Token rotation failed:", err);
    return null;
  }
}

export async function unregisterPush(token: string) {
  if (!token) return;
  try {
    await deleteDoc(doc(db, "devices", token));
    if (lastSavedToken === token) lastSavedToken = null;
  } catch (err) {
    console.error("Failed to unregister push:", err);
  }
}

export function listenForSubscriptionChange(handler: () => Promise<void>) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Listen to messages from service worker indicating the subscription changed
  navigator.serviceWorker.addEventListener("message", (event) => {
    try {
      const data = event.data || {};
      if (data && data.type === "PUSH_SUBSCRIPTION_CHANGE") {
        console.log(
          "Received PUSH_SUBSCRIPTION_CHANGE from SW; re-registering token",
        );
        handler();
      }
    } catch (err) {
      console.warn("Error handling SW message", err);
    }
  });

  // Also refresh token when page becomes visible
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      console.log("Page visible — refreshing FCM token");
      handler();
    }
  });
}

export function onForegroundMessage(callback: (payload: any) => void) {
  try {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      callback(payload);
    });
  } catch (err) {
    console.warn("onForegroundMessage not available", err);
  }
}
