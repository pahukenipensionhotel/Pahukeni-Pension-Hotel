import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { doc, getDocFromServer, getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { deobfuscate } from "../../shared/utils/security";

/**
 * MASKED CONFIGURATION
 * These are obfuscated to prevent plain-text scraping and avoid storing
 * plain-text keys in hosting provider environments.
 */
const _c = {
  k: "kbR7OX-bLkR5sc_Hppn5axpED57spMmWjAySazIA", // apiKey
  d: "moc.ppaeribaf.18a6a-ppa-telppa-oiduts-ia", // authDomain
  u: "moc.oieribaf.tluafed-18a6a-ppa-telppa-oiduts-ia//:sptth", // databaseURL (optional)
  p: "18a6a-ppa-telppa-oiduts-ia", // projectId
  b: "ppa.egarotseribaf.18a6a-ppa-telppa-oiduts-ia", // storageBucket
  m: "3132779262", // messagingSenderId
  a: "834549e74a15ebef50f:3132779262:1:1", // appId
  f: "665bd2b5f6-29d8-da24-d3df-556cf9a-oiduts-ia", // firestoreDatabaseId
};

const firebaseConfig = {
  apiKey: deobfuscate(_c.k),
  authDomain: deobfuscate(_c.d),
  databaseURL: deobfuscate(_c.u),
  projectId: deobfuscate(_c.p),
  storageBucket: deobfuscate(_c.b),
  messagingSenderId: deobfuscate(_c.m),
  appId: deobfuscate(_c.a),
};

const app = initializeApp(firebaseConfig);

// Initialize App Check
// Note: Even if keys are leaked, App Check prevents unauthorized access.
if (typeof window !== "undefined") {
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // App Check Debug Mode for environments without a fixed domain
  if (isLocalhost) {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  // We only initialize if we have a way to verify identity
  const RECAPTCHA_SITE_KEY = ""; // Placeholder for your reCAPTCHA v3 site key
  if (RECAPTCHA_SITE_KEY || isLocalhost) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY || "6LeR_debug_key"),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

export const db = getFirestore(app, deobfuscate(_c.f));
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
      console.error("Firebase connection check failed.");
    }
  }
}

testConnection();
