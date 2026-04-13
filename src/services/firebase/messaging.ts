import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "./client";
import firebaseConfig from "../../../firebase-applet-config.json";

// VAPID key should be set from your Firebase Console (Cloud Messaging settings)
const DEFAULT_VAPID_KEY = process.env.VITE_FIREBASE_VAPID_KEY || "";

let lastSavedToken: string | null = null;

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
    // Register service worker from the public root
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    console.log("Service worker registered:", registration.scope);

    const messaging = getMessaging();

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission not granted.");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("No registration token available.");
      return null;
    }

    // If token changed, update Firestore
    if (token !== lastSavedToken) {
      const owner = auth.currentUser?.uid || null;
      const deviceRef = doc(db, "devices", token);
      await setDoc(
        deviceRef,
        {
          owner: owner,
          token: token,
          platform: "web",
          created_at: new Date().toISOString(),
        },
        { merge: true },
      );
      lastSavedToken = token;
      console.log("Saved/updated device token to Firestore:", token);
    } else {
      console.log("Token unchanged.");
    }

    return token;
  } catch (err) {
    console.error("Failed to register for push:", err);
    return null;
  }
}

export async function unregisterPush(token: string) {
  if (!token) return;
  try {
    await deleteDoc(doc(db, "devices", token));
    if (lastSavedToken === token) lastSavedToken = null;
    console.log("Deleted device token doc for", token);
  } catch (err) {
    console.error("Failed to delete device token doc", err);
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  try {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      callback(payload);
    });
  } catch (err) {
    console.warn("onForegroundMessage not available in this environment", err);
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
