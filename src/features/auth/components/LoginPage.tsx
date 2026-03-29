import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../../services/firebase/client";
import {
  requireText,
  validateEmailAddress,
} from "../../../shared/validation/inputs";
import { IMAGE_CATALOG } from "../../../shared/assets/imageCatalog";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const heroImages = IMAGE_CATALOG.hero;
    heroImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    const intervalId = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % heroImages.length);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setError("Password reset email sent! Please check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      setError(err.message || "Guest login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isRegistering) {
        const normalizedEmail = validateEmailAddress(email);
        const normalizedName = requireText(
          name || normalizedEmail.split("@")[0],
          "Full name",
          80,
        );
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password,
        );
        await setDoc(doc(db, "users", userCredential.user.uid), {
          username: normalizedEmail.split("@")[0],
          name: normalizedName,
          role: "Customer",
          email: normalizedEmail,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === "auth/invalid-credential") {
        let message =
          'Invalid email or password. If you have not registered yet, please click "Register here" below.';
        if (email === "pahukenipensionhotelcc@gmail.com") {
          message += ' Tip: try "Sign in with Google" for this admin account.';
        }
        setError(message);
      } else if (err.code === "auth/user-not-found") {
        setError("No account found with this email. Please register first.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError(
          "Too many failed login attempts. Please try again later or reset your password.",
        );
      } else if (err.code === "auth/operation-not-allowed") {
        setError(
          "Email/password login is not enabled in Firebase Authentication.",
        );
      } else {
        setError(err.message || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError(
          "The login popup was closed before completion. Please try again.",
        );
      } else if (err.code === "auth/popup-blocked") {
        setError(
          "The login popup was blocked by your browser. Please allow popups for this site.",
        );
      } else if (err.code === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized for Google login in Firebase Authentication.",
        );
      } else {
        setError(err.message || "Google login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] grid lg:grid-cols-[1.2fr_0.8fr]">
      <div className="relative hidden lg:block overflow-hidden">
        {IMAGE_CATALOG.hero.map((src, index) => (
          <motion.img
            key={src}
            src={src}
            alt="Pahukeni scenic property view"
            className="absolute inset-0 h-full w-full object-cover"
            initial={false}
            animate={{
              opacity: index === activeImageIndex ? 1 : 0,
              scale: index === activeImageIndex ? 1 : 1.03,
            }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-white/70">
            Pahukeni Pension Hotel
          </p>
          <h2 className="mt-3 max-w-md text-4xl font-serif italic leading-tight">
            Scenic stays, warm service, and one shared welcome for staff and
            guests.
          </h2>
        </div>
      </div>
      <div className="flex items-center justify-center p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-black/5"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif italic text-[#141414] mb-2">
              Pahukeni Pension
            </h1>
            <p className="text-sm text-black/50 uppercase tracking-widest font-mono">
              {isRegistering ? "Customer Registration" : "Management System"}
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3">
              <div className="overflow-hidden rounded-2xl lg:hidden">
                <AnimatePresence mode="sync" initial={false}>
                  <motion.img
                    key={IMAGE_CATALOG.hero[activeImageIndex]}
                    src={IMAGE_CATALOG.hero[activeImageIndex]}
                    alt="Pahukeni scenic property view"
                    className="h-44 w-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </AnimatePresence>
              </div>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-4 bg-white text-black border border-black/10 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isRegistering ? "Register with Google" : "Sign in with Google"}
              </button>
              <button
                onClick={handleGuestLogin}
                disabled={loading}
                className="w-full py-3 bg-[#f5f5f5] text-black/60 border border-black/5 rounded-xl text-xs font-mono uppercase hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Sign in as Guest
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/5" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono">
                <span className="bg-white px-2 text-black/30">
                  Or use email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="block text-xs font-mono uppercase text-black/40 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 bg-[#f5f5f5] border border-black/5 rounded-xl focus:outline-none focus:border-black/20 transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-mono uppercase text-black/40 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 bg-[#f5f5f5] border border-black/5 rounded-xl focus:outline-none focus:border-black/20 transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-mono uppercase text-black/40">
                    Password
                  </label>
                  {!isRegistering && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] font-mono uppercase text-black/30 hover:text-black transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 bg-[#f5f5f5] border border-black/5 rounded-xl focus:outline-none focus:border-black/20 transition-colors"
                  placeholder="........"
                  required
                />
              </div>
              {error && (
                <p className="text-red-500 text-xs font-mono leading-relaxed">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#141414] text-white rounded-xl font-medium hover:bg-black/90 transition-colors shadow-lg shadow-black/10 disabled:opacity-50"
              >
                {loading
                  ? "Processing..."
                  : isRegistering
                    ? "Register"
                    : "Sign In"}
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-xs font-mono uppercase text-black/40 hover:text-black transition-colors"
              >
                {isRegistering
                  ? "Already have an account? Sign In"
                  : "New Guest? Register here"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
