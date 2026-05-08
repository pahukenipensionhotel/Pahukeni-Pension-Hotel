import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import {
  Firestore,
  doc,
  getDocFromServer,
  initializeFirestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

type FirebaseSingleton = {
  db?: Firestore;
};

const firebaseSingleton = globalThis as typeof globalThis & {
  __pahukeniFirebase?: FirebaseSingleton;
};

const singletonState =
  firebaseSingleton.__pahukeniFirebase ??
  (firebaseSingleton.__pahukeniFirebase = {});

export const db =
  singletonState.db ??
  (singletonState.db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }));

export const auth = getAuth(app);

if (typeof window !== "undefined") {
  void isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => {
      // Analytics is optional in unsupported environments.
    });
}

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
      console.error("Connection check failed.");
    }
  }
}

testConnection();
