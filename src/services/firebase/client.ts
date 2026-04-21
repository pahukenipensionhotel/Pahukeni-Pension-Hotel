import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { doc, getDocFromServer, getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { deobfuscate } from "../../shared/utils/security";

/**
 * SECURE MASKED CONFIGURATION
 * XOR + Base64 obfuscation to prevent scraping and plain-text exposure.
 */
const _c = {
  k: "MSgSFDgcLyMoPQg+AF5aKhpCSFMDHhEYPTQWDVwNGwciXjEgWQ1Z",
  d: "EQhFBh8QCgAwXQQeAwUKGnJFVVBXABFFFF0EVlhxFgwcFgsOHTpTQEIYEw4F",
  u: "GBUcBRhfQUY+GUgdBxwLBzAfUUJGHAQcWBwADAgvAEgPRQhXX3JWVVRXBQ0cWBkRCgtxFgwcFgsOHTpbXxxVHww=",
  p: "EQhFBh8QCgAwXQQeAwUKGnJFVVBXABFFFF0EVlg=",
  b: "EQhFBh8QCgAwXQQeAwUKGnJFVVBXABFFFF0EVlhxFgwcFgsOHTpBRF1EEQYNWwoVHg==",
  m: "QldaR1JSWVFtQ1Rd",
  a: "QVtaQ1lXV15oSFddQlpVGTpQClQGRQcNFw5UWghoFVxaRlgOC2gGAwo=",
  f: "EQhFBh8QCgAwXVIPSg8MWGoHHVRSQwVFQVlRD0RnFFxcXgpZCGoAUlZSFlReQw==",
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

if (typeof window !== "undefined") {
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocalhost) {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const RECAPTCHA_SITE_KEY = "";
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
      console.error("Connection check failed.");
    }
  }
}

testConnection();
