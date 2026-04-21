import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { doc, getDocFromServer, getFirestore } from "firebase/firestore";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  CustomProvider,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Initialize App Check with Debug support for environments without domains
if (typeof window !== "undefined") {
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  // Use debug mode if on localhost OR if explicitly requested via env
  if (isLocalhost || import.meta.env.VITE_APP_CHECK_DEBUG === "true") {
    // This allows App Check to work on localhost/temporary URLs
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  if (RECAPTCHA_SITE_KEY || isLocalhost) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        RECAPTCHA_SITE_KEY || "6LeR_...dummy_key_for_debug...",
      ),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

export const db = getFirestore(
  app,
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
);
export const auth = getAuth(app);

async function testConnection() {
  try {
    if (typeof window !== "undefined") {
      await getDocFromServer(doc(db, "_connection_test", "ping"));
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error(
        "Please check your Firebase configuration. The client is offline.",
      );
    }
  }
}

testConnection();
