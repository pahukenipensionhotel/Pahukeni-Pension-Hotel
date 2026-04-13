import React, { useState, useEffect, useMemo, Component, useRef } from "react";
import {
  LayoutDashboard,
  Bed,
  Utensils,
  Beer,
  WashingMachine,
  Calendar,
  FileText,
  Users,
  LogOut,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Printer,
  X,
  Menu,
  Home as HomeIcon,
  ClipboardList,
  RefreshCw,
  Trash2,
  Edit2,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type {
  Stats,
  Room,
  MenuItem,
  Order,
  LaundryOrder,
  User,
  ConferenceRoom,
  ConferenceService,
  LaundryService,
  Notification as HotelNotification,
} from "./shared/types/hotel";
import { auth, db } from "./firebase";
import { NotificationService } from "./services/notificationService";
import {
  getHashTab as getRouteHashTab,
  PORTAL_TABS as PORTAL_ROUTE_TABS,
  STAFF_TABS as STAFF_ROUTE_TABS,
  syncHashTab as syncRouteHashTab,
} from "./app/router/routeState";
import { isStaffRole } from "./shared/security/roles";
import {
  canAccessStaffArea,
  canManageConference,
  canManageInventory as canManageInventoryRole,
  canManageLaundry,
  canManagePosMenu,
  canManageRooms,
  canManageStaff,
  canReceiveFrontDeskNotifications,
  canReceiveOrderNotifications,
  isAdmin,
} from "./shared/security/authorization";
import {
  requireText,
  sanitizeText,
  validateEmailAddress,
  handleFirestoreError,
  OperationType,
  parseNumberInput,
} from "./shared/validation/inputs";
import { IMAGE_CATALOG } from "./shared/assets/imageCatalog";
import { Dashboard as DashboardPage } from "./features/dashboard/components/Dashboard";
import { LoginPage as AuthLoginPage } from "./features/auth/components/LoginPage";
import { NotificationCenter as NotificationCenterPanel } from "./features/notifications/components/NotificationCenter";
import { RoomsModule } from "./features/rooms/components/RoomsModule";
import { RoomDetailsModal } from "./features/rooms/components/RoomDetailsModal";
import { ErrorBoundary as AppErrorBoundary } from "./shared/components/ErrorBoundary";
import {
  createWorkflowNotification,
  notifyRole,
  notifyUser,
  buildCustomerOrderNotification,
  buildLaundryStatusMessage,
  buildOrderStatusMessage,
} from "./features/notifications/services/notificationWorkflow";
import { resolveUserProfile } from "./features/auth/services/resolveUserProfile";
import { markNotificationRead } from "./features/notifications/repositories/notificationsRepository";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInAnonymously,
} from "firebase/auth";
import { initializeApp, getApp, deleteApp } from "firebase/app";
import firebaseConfig from "../firebase-applet-config.json";
import usePushNotifications from "./hooks_usePushNotifications";
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  getDocs,
  getDoc,
  Timestamp,
  orderBy,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// --- Constants ---
const LOCAL_ASSETS = IMAGE_CATALOG;

const STAFF_TABS = new Set([
  "dashboard",
  "rooms",
  "restaurant",
  "bar",
  "laundry",
  "conference",
  "reports",
  "staff",
]);
const PORTAL_TABS = new Set([
  "home",
  "rooms",
  "dining",
  "orders",
  "laundry",
  "conference",
]);

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function getDefaultRoomImage(room: Pick<Room, "category" | "number">) {
  if (room.category === "Single") return LOCAL_ASSETS.rooms.single;
  if (room.number === "202") return LOCAL_ASSETS.rooms.doubleAlt;
  if (room.number === "201") return LOCAL_ASSETS.rooms.double;
  if (room.category === "VIP" || room.category === "Suite")
    return LOCAL_ASSETS.rooms.vip;
  if (room.category === "Double") return LOCAL_ASSETS.rooms.double;
  return LOCAL_ASSETS.rooms.single;
}

function getDefaultMenuImage(
  item: Pick<MenuItem, "name" | "type" | "category" | "imageUrl">,
) {
  const normalizedName = item.name.trim().toLowerCase();

  if (normalizedName === "t-bone steak") return LOCAL_ASSETS.menu.steak;
  if (normalizedName === "grilled hake") return LOCAL_ASSETS.menu.fish;
  if (normalizedName === "greek salad") return LOCAL_ASSETS.menu.salad;
  if (normalizedName === "windhoek lager") return LOCAL_ASSETS.menu.beer;
  if (normalizedName === "red wine glass") return LOCAL_ASSETS.menu.wine;

  if (
    item.imageUrl &&
    item.imageUrl.startsWith("/assets/images/") &&
    !item.imageUrl.endsWith(".svg")
  ) {
    return item.imageUrl;
  }

  if (item.type === "Bar" || item.category === "Drinks") {
    return LOCAL_ASSETS.showcase.bar[0];
  }

  return LOCAL_ASSETS.showcase.restaurant[0];
}

function getMenuImage(
  item: Pick<MenuItem, "name" | "type" | "category" | "imageUrl">,
) {
  if (
    item.imageUrl &&
    !item.imageUrl.includes("picsum.photos") &&
    !item.imageUrl.includes("pexels.com") &&
    !item.imageUrl.endsWith(".svg")
  ) {
    return item.imageUrl;
  }

  return getDefaultMenuImage(item);
}

function getHashTab(
  scope: "staff" | "portal",
  validTabs: Set<string>,
  fallback: string,
) {
  if (typeof window === "undefined") return fallback;

  const [hashScope, hashTab] = window.location.hash
    .replace(/^#\/?/, "")
    .split("/");
  return hashScope === scope && hashTab && validTabs.has(hashTab)
    ? hashTab
    : fallback;
}

function syncHashTab(scope: "staff" | "portal", tab: string) {
  if (typeof window === "undefined") return;

  const nextHash = `#/${scope}/${tab}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if ((this.state as any).hasError) {
      let displayError = (this.state as any).error;
      let isFirestoreError = false;
      try {
        const parsed = JSON.parse(displayError.message);
        if (parsed.operationType) {
          displayError = parsed;
          isFirestoreError = true;
        }
      } catch (e) {}

      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-100">
            <h2 className="text-2xl font-serif text-red-600 mb-4">
              System Error
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {isFirestoreError
                ? `A database error occurred during ${displayError.operationType} on ${displayError.path}.`
                : "An unexpected error occurred. Please try refreshing the page."}
            </p>
            <pre className="bg-gray-50 p-4 rounded-xl text-[10px] font-mono overflow-auto mb-6 max-h-40">
              {JSON.stringify(displayError, null, 2)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-medium"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Components ---

const HotelNotificationCenter = ({
  notifications,
  onClose,
  onMarkAsRead,
  onNavigate,
}: {
  notifications: HotelNotification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onNavigate: (type: string, title: string) => void;
}) => {
  const uniqueHotelNotifications = dedupeById(notifications);

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-black/5 z-[100] overflow-hidden">
      <div className="p-4 border-bottom border-black/5 flex items-center justify-between bg-gray-50">
        <h3 className="text-sm font-serif italic">HotelNotifications</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/5 rounded-full transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {uniqueHotelNotifications.length === 0 ? (
          <div className="p-8 text-center text-black/20 font-mono text-xs">
            No notifications
          </div>
        ) : (
          uniqueHotelNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 border-bottom border-black/5 last:border-0 transition-colors cursor-pointer hover:bg-gray-50 ${!notif.read ? "bg-blue-50/30" : ""}`}
              onClick={() => {
                onMarkAsRead(notif.id);
                onNavigate(notif.type, notif.title);
                onClose();
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    notif.type === "order"
                      ? "bg-blue-100 text-blue-600"
                      : notif.type === "laundry"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Bell size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium mb-1">{notif.title}</p>
                  <p className="text-[10px] text-black/60 leading-relaxed mb-2">
                    {notif.message}
                  </p>
                  <p className="text-[8px] font-mono text-black/30 uppercase">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1"></div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");

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
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        // Create customer profile using UID as document ID
        await setDoc(doc(db, "users", userCredential.user.uid), {
          username: email.split("@")[0],
          name: name || email.split("@")[0],
          role: "Customer",
          email: email,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err.code, err.message);
      if (err.code === "auth/invalid-credential") {
        let msg =
          'Invalid email or password. If you haven\'t registered yet, please click "Register here" below.';
        if (email === "pahukenipensionhotelcc@gmail.com") {
          msg += ' Tip: Try "Sign in with Google" for this admin account.';
        }
        setError(msg);
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
          "Email/Password login is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.",
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
      const provider = new GoogleAuthProvider();
      // Ensure the popup isn't blocked by requesting it directly in the event handler
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError(
          "The login popup was closed before completion. Please try again and keep the window open. Also, ensure third-party cookies are enabled in your browser.",
        );
      } else if (err.code === "auth/popup-blocked") {
        setError(
          "The login popup was blocked by your browser. Please allow popups for this site.",
        );
      } else if (err.code === "auth/unauthorized-domain") {
        setError(
          'This domain is not authorized for Google login. Please add your Vercel domain to the "Authorized Domains" list in the Firebase Console (Authentication > Settings).',
        );
      } else {
        setError(err.message || "Google login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
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
              <div className="w-full border-t border-black/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono">
              <span className="bg-white px-2 text-black/30">Or use email</span>
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
                placeholder="••••••••"
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
  );
};

const Dashboard = ({
  stats,
  bookings,
}: {
  stats: Stats | null;
  bookings: any[];
}) => {
  if (!stats) return null;

  const cards = [
    {
      label: "Active Guests",
      value: stats.activeGuests,
      icon: Users,
      color: "text-blue-600",
    },
    {
      label: "Available Rooms",
      value: stats.availableRooms,
      icon: Bed,
      color: "text-emerald-600",
    },
    {
      label: "Pending Laundry",
      value: stats.pendingLaundry,
      icon: WashingMachine,
      color: "text-orange-600",
    },
    {
      label: "Daily Revenue",
      value: `N$ ${stats.totalRevenue.toLocaleString()}`,
      icon: FileText,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl bg-gray-50 ${card.color}`}>
                <card.icon size={20} />
              </div>
              <span className="text-[10px] font-mono text-black/30 uppercase tracking-wider">
                Live
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-serif italic text-[#141414]">
              {card.value}
            </h3>
            <p className="text-[10px] sm:text-xs font-mono text-black/40 uppercase mt-1">
              {card.label}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
          <h2 className="text-xl font-serif italic mb-6">Recent Bookings</h2>
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <p className="text-sm text-black/20 font-mono text-center py-8">
                No recent activity
              </p>
            ) : (
              bookings.slice(0, 5).map((booking, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-black/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-black/5">
                      <Clock size={16} className="text-black/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {booking.guest_name || "Guest"} - Room{" "}
                        {booking.room_number}
                      </p>
                      <p className="text-[10px] font-mono text-black/40">
                        {booking.status}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-black/20" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
          <h2 className="text-xl font-serif italic mb-6">System Status</h2>
          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 flex items-center gap-4">
            <CheckCircle2 size={24} />
            <div>
              <p className="text-sm font-medium">All systems operational</p>
              <p className="text-xs opacity-70">
                Database connected and syncing in real-time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InventoryModule = ({
  menu,
  isAdmin,
  userRole,
}: {
  menu: MenuItem[];
  isAdmin: boolean;
  userRole?: string;
}) => {
  const [isAddingStock, setIsAddingStock] = useState<string | null>(null);
  const [isDeductingStock, setIsDeductingStock] = useState<string | null>(null);
  const [stockAmount, setStockAmount] = useState(0);
  const [showReport, setShowReport] = useState(false);

  const barMenu = menu.filter((item) => item.type === "Bar");

  const handleUpdateStock = async (itemId: string, amount: number) => {
    try {
      const item = barMenu.find((m) => m.id === itemId);
      if (!item) return;
      const newStock = Math.max(0, (item.stock || 0) + amount);
      const newStatus = newStock === 0 ? "Out of Stock" : "Available";
      await updateDoc(doc(db, "menu_items", itemId), {
        stock: newStock,
        status: newStatus,
      });
      setIsAddingStock(null);
      setIsDeductingStock(null);
      setStockAmount(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "menu_items");
    }
  };

  const reportData = useMemo(() => {
    const available = barMenu.filter((item) => (item.stock || 0) > 0);
    const outOfStock = barMenu.filter((item) => (item.stock || 0) === 0);
    const totalValue = barMenu.reduce(
      (acc, item) => acc + (item.stock || 0) * (item.costPrice || 0),
      0,
    );

    return { available, outOfStock, totalValue };
  }, [barMenu]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-serif italic">
            Bar Inventory Management
          </h3>
          <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest">
            Track and manage beverage stock levels
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          className="px-4 py-2 bg-black text-white rounded-xl text-xs font-mono uppercase tracking-widest flex items-center gap-2"
        >
          <FileText size={14} />
          Daily Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {barMenu.map((item) => (
          <div
            key={item.id}
            className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-mono text-black/30 uppercase">
                  {item.category}
                </p>
                <h4 className="font-medium text-[#141414]">{item.name}</h4>
              </div>
              <span
                className={`px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider
                ${(item.stock || 0) <= (item.minStock || 5) ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}
              >
                Stock: {item.stock || 0}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#F5F5F0] p-3 rounded-xl">
                <p className="text-[8px] font-mono text-black/40 uppercase mb-1">
                  Cost Price
                </p>
                <p className="font-mono text-sm">N$ {item.costPrice || 0}</p>
              </div>
              <div className="bg-[#F5F5F0] p-3 rounded-xl">
                <p className="text-[8px] font-mono text-black/40 uppercase mb-1">
                  Selling Price
                </p>
                <p className="font-mono text-sm">N$ {item.price}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsAddingStock(item.id)}
                className="flex-1 py-2.5 bg-black text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-black/80 transition-colors"
              >
                Add Stock
              </button>
              <button
                onClick={() => setIsDeductingStock(item.id)}
                className="flex-1 py-2.5 bg-white text-black border border-black/10 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-black/5 transition-colors"
              >
                Deduct
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Stock Modal */}
      <AnimatePresence>
        {(isAddingStock || isDeductingStock) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  {isAddingStock ? "Add Stock" : "Deduct Stock"}
                </h3>
                <button
                  onClick={() => {
                    setIsAddingStock(null);
                    setIsDeductingStock(null);
                  }}
                  className="text-black/40 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={stockAmount}
                    onChange={(e) =>
                      setStockAmount(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5 font-mono"
                    placeholder="Enter quantity..."
                  />
                </div>
                <button
                  onClick={() =>
                    handleUpdateStock(
                      (isAddingStock || isDeductingStock)!,
                      isAddingStock ? stockAmount : -stockAmount,
                    )
                  }
                  className="w-full py-4 bg-black text-white rounded-2xl text-xs font-mono uppercase tracking-widest hover:bg-black/80 transition-all"
                >
                  Confirm Update
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-serif italic">
                    End of Day Inventory Report
                  </h3>
                  <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
                    {new Date().toLocaleDateString("en-US", {
                      dateStyle: "full",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setShowReport(false)}
                  className="text-black/40 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4 border-b border-black/5 pb-2">
                    Available Stock
                  </h4>
                  <div className="space-y-2">
                    {reportData.available.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center py-2 border-b border-black/5 last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-[10px] text-black/40">
                            Cost: N$ {item.costPrice} | Price: N$ {item.price}
                          </p>
                        </div>
                        <span className="font-mono text-sm">
                          {item.stock} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-red-400 mb-4 border-b border-red-100 pb-2">
                    Out of Stock
                  </h4>
                  <div className="space-y-2">
                    {reportData.outOfStock.length > 0 ? (
                      reportData.outOfStock.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center py-2 border-b border-black/5 last:border-0"
                        >
                          <p className="font-medium text-sm text-red-600">
                            {item.name}
                          </p>
                          <span className="font-mono text-sm text-red-600">
                            0 units
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-black/30 italic">
                        No items currently out of stock.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-[#141414] text-white p-6 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">
                        Total Inventory Value (Cost)
                      </p>
                      <p className="text-2xl font-serif italic">
                        N$ {reportData.totalValue.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const POSModule = ({
  type,
  menu,
  orders,
  isAdmin,
  userRole,
  user,
  createNotification,
}: {
  type: "Restaurant" | "Bar";
  menu: MenuItem[];
  orders: Order[];
  isAdmin: boolean;
  userRole?: string;
  user: User;
  createNotification: (notif: any) => Promise<void>;
}) => {
  const [cart, setCart] = useState<{ item: any; qty: number }[]>([]);
  const [table, setTable] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    price: 0,
    category: "",
    type,
    status: "Available" as const,
    costPrice: 0,
    stock: 0,
    minStock: 5,
  });
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<
    "menu" | "orders" | "inventory"
  >(type === "Restaurant" ? "orders" : "menu");

  const filteredMenu = menu.filter((item) => item.type === type);
  const filteredOrders = orders
    .filter((order) => order.type === type)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const canManageMenu = canManagePosMenu(
    type,
    userRole as User["role"] | undefined,
  );
  const canManageInventory = canManageInventoryRole(
    userRole as User["role"] | undefined,
  );
  const moduleShowcase =
    type === "Restaurant"
      ? {
          title: "Dining Spaces",
          description:
            "Use the real restaurant imagery to ground the POS experience in the property itself.",
          images: LOCAL_ASSETS.showcase.restaurant,
        }
      : {
          title: "Bar Atmosphere",
          description:
            "The bar workspace now carries actual venue photography from the property.",
          images: LOCAL_ASSETS.showcase.bar,
        };

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing)
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...prev, { item, qty: 1 }];
    });
  };

  const total = cart.reduce((sum, i) => sum + i.item.price * i.qty, 0);

  const handlePlaceOrder = async () => {
    try {
      await addDoc(collection(db, "orders"), {
        table_number: table,
        items: cart.map((c) => ({
          name: c.item.name,
          price: c.item.price,
          qty: c.qty,
        })),
        total_price: total,
        status: "Pending",
        type,
        created_at: new Date().toISOString(),
        // If staff is placing order for a customer, we might not have their UID here
        // but we can mark it as staff-placed
        placed_by: userRole,
      });

      // Notify relevant staff
      if (type === "Bar") {
        await notifyRole({
          role: "Barman",
          title: "New Bar Order",
          message: `New order for Table ${sanitizeText(table || "Walk-in", 40)} placed by ${sanitizeText(userRole || "Guest", 40)}`,
          type: "order",
        });
      } else if (type === "Restaurant") {
        await notifyRole({
          role: "Waiter",
          title: "New Restaurant Order",
          message: `New order for Table ${sanitizeText(table || "Walk-in", 40)} placed by ${sanitizeText(userRole || "Reception", 40)}`,
          type: "order",
        });
      }

      // Deduct stock for Bar items
      if (type === "Bar") {
        for (const cartItem of cart) {
          const menuItem = menu.find((m) => m.id === cartItem.item.id);
          if (menuItem && menuItem.stock !== undefined) {
            const newStock = Math.max(0, menuItem.stock - cartItem.qty);
            const newStatus = newStock === 0 ? "Out of Stock" : menuItem.status;
            await updateDoc(doc(db, "menu_items", menuItem.id), {
              stock: newStock,
              status: newStatus,
            });
          }
        }
      }

      setCart([]);
      setTable("");
      setShowPrintConfirm(false);
      setIsConfirmed(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "orders");
    }
  };

  const handlePrintRequest = () => {
    setShowPrintConfirm(true);
    setIsConfirmed(false);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "menu_items"), newItem);
      setIsAdding(false);
      setNewItem({
        name: "",
        price: 0,
        category: "",
        type,
        status: "Available",
        costPrice: 0,
        stock: 0,
        minStock: 5,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "menu_items");
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "menu_items", itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "menu_items");
    }
  };

  const toggleItemStatus = async (item: MenuItem) => {
    try {
      const newStatus =
        item.status === "Available" ? "Out of Stock" : "Available";
      await updateDoc(doc(db, "menu_items", item.id), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "menu_items");
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    newStatus: Order["status"],
    estimatedArrival?: string,
  ) => {
    try {
      const updateData: any = { status: newStatus };
      if (estimatedArrival) updateData.estimated_arrival = estimatedArrival;
      await updateDoc(doc(db, "orders", orderId), updateData);

      // Create notification for the customer if the order has an email
      const order = orders.find((o) => o.id === orderId);
      if (order && order.customer_email) {
        await notifyUser({
          userId: order.customer_uid,
          title: "Order Update",
          message: buildOrderStatusMessage(
            type,
            sanitizeText(newStatus, 30),
            estimatedArrival ? sanitizeText(estimatedArrival, 40) : undefined,
          ),
          type: "order",
          orderId: orderId,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "orders");
    }
  };

  const [estArrival, setEstArrival] = useState<{ [key: string]: string }>({});

  const incomingOrders = filteredOrders.filter((o) => o.status === "Pending");
  const activeOrders = filteredOrders.filter(
    (o) =>
      o.status !== "Pending" &&
      o.status !== "Completed" &&
      o.status !== "Cancelled" &&
      o.status !== "Paid",
  );

  return (
    <div className="flex flex-col gap-8 h-auto lg:h-[calc(100vh-12rem)]">
      {/* Sub-navigation */}
      <div className="flex bg-white/50 p-1 rounded-xl border border-black/5 w-fit">
        {type === "Restaurant" ? (
          <>
            <button
              onClick={() => setActiveSubTab("orders")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "orders" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Live Orders
            </button>
            <button
              onClick={() => setActiveSubTab("menu")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "menu" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Menu Management
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveSubTab("menu")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "menu" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Bar POS
            </button>
            <button
              onClick={() => setActiveSubTab("orders")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "orders" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Orders
            </button>
            {canManageInventory && (
              <button
                onClick={() => setActiveSubTab("inventory")}
                className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                  ${activeSubTab === "inventory" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
              >
                Inventory
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto pr-0 lg:pr-4">
          {activeSubTab === "inventory" ? (
            <InventoryModule
              menu={menu}
              isAdmin={isAdmin}
              userRole={userRole}
            />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-serif italic">
                  {type} {activeSubTab === "orders" ? "Live Orders" : "Menu"}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  {(activeSubTab === "menu" || activeSubTab === "inventory") &&
                    canManageMenu && (
                      <button
                        onClick={() => setIsAdding(true)}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-black text-white rounded-xl text-[10px] sm:text-xs font-mono uppercase tracking-widest whitespace-nowrap"
                      >
                        Add Item
                      </button>
                    )}
                  <div className="relative flex-1 sm:flex-none">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder={
                        activeSubTab === "menu"
                          ? "Search menu..."
                          : "Search orders..."
                      }
                      className="w-full sm:w-auto pl-9 pr-4 py-1.5 sm:py-2 bg-white border border-black/5 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-black/20"
                    />
                  </div>
                </div>
              </div>

              {activeSubTab === "menu" && (
                <div
                  className={`grid gap-4 ${moduleShowcase.images.length > 1 ? "grid-cols-1 lg:grid-cols-[1.35fr,1fr]" : "grid-cols-1"}`}
                >
                  <div className="relative overflow-hidden rounded-3xl border border-black/5 min-h-[280px]">
                    <img
                      src={moduleShowcase.images[0]}
                      alt={moduleShowcase.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                    <div className="relative flex h-full flex-col justify-end p-6 text-white">
                      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/60">
                        {type === "Restaurant" ? "Restaurant" : "Bar"}
                      </p>
                      <h3 className="mt-2 text-2xl font-serif italic">
                        {moduleShowcase.title}
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-white/80">
                        {moduleShowcase.description}
                      </p>
                    </div>
                  </div>
                  {moduleShowcase.images.length > 1 && (
                    <div className="grid grid-cols-2 gap-4">
                      {moduleShowcase.images.slice(1).map((image, index) => (
                        <div
                          key={image}
                          className="relative overflow-hidden rounded-3xl border border-black/5 min-h-[180px]"
                        >
                          <img
                            src={image}
                            alt={`${moduleShowcase.title} ${index + 2}`}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === "menu" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMenu.map((item) => (
                    <motion.div
                      key={item.id}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-white p-4 rounded-2xl border border-black/5 text-left hover:shadow-md transition-all group relative
                        ${item.status === "Out of Stock" ? "opacity-60" : ""}`}
                    >
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {canManageMenu && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemStatus(item);
                              }}
                              className={`p-1 rounded-lg transition-colors ${item.status === "Available" ? "text-orange-400 hover:text-orange-600" : "text-emerald-400 hover:text-emerald-600"}`}
                              title={
                                item.status === "Available"
                                  ? "Mark Out of Stock"
                                  : "Mark Available"
                              }
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMenuItem(item.id);
                              }}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          item.status === "Available" && addToCart(item)
                        }
                        disabled={item.status === "Out of Stock"}
                        className="w-full h-full text-left"
                      >
                        <div className="mb-4 overflow-hidden rounded-2xl border border-black/5 bg-[#F5F5F0] aspect-[4/3]">
                          <img
                            src={getMenuImage(item)}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[10px] font-mono text-black/30 uppercase">
                            {item.category}
                          </p>
                          {item.status === "Out of Stock" && (
                            <span className="text-[8px] font-mono bg-red-50 text-red-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                              Out of Stock
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-[#141414] group-hover:text-black transition-colors">
                          {item.name}
                        </p>
                        <p className="text-sm font-serif italic mt-2">
                          N$ {item.price}
                        </p>
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Side: Received Orders (Processing) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <h3 className="text-sm font-mono uppercase tracking-widest text-black/60">
                        Received Orders
                      </h3>
                    </div>
                    {activeOrders.length === 0 ? (
                      <div className="bg-white/50 p-8 rounded-2xl border border-dashed border-black/10 text-center">
                        <p className="text-xs text-black/30 font-mono">
                          No orders in process
                        </p>
                      </div>
                    ) : (
                      activeOrders.map((order) => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-serif italic text-lg">
                                {order.customer_name
                                  ? `Guest: ${order.customer_name}`
                                  : `Table ${order.table_number}`}
                              </h4>
                              <p className="text-[10px] font-mono text-black/40 uppercase">
                                {new Date(
                                  order.created_at,
                                ).toLocaleTimeString()}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider
                              ${
                                order.status === "Accepted"
                                  ? "bg-blue-50 text-blue-600"
                                  : order.status === "Preparing"
                                    ? "bg-purple-50 text-purple-600"
                                    : order.status === "Serving"
                                      ? "bg-indigo-50 text-indigo-600"
                                      : "bg-gray-50 text-gray-600"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>

                          <div className="space-y-1 mb-4 border-y border-black/5 py-3">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-black/60">
                                  {item.name} x {item.qty}
                                </span>
                                <span className="font-mono opacity-40">
                                  N$ {item.price * item.qty}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-2 font-serif italic text-sm">
                              <span>Total</span>
                              <span>N$ {order.total_price}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {order.status === "Accepted" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "Preparing")
                                }
                                className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-purple-700 transition-colors"
                              >
                                Start Prep
                              </button>
                            )}
                            {order.status === "Preparing" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "Serving")
                                }
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                              >
                                Ready
                              </button>
                            )}
                            {order.status === "Serving" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "Completed")
                                }
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              onClick={() =>
                                updateOrderStatus(order.id, "Cancelled")
                              }
                              className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-red-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Right Side: Incoming Orders (New) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></div>
                      <h3 className="text-sm font-mono uppercase tracking-widest text-black/60">
                        Incoming Orders
                      </h3>
                    </div>
                    {incomingOrders.length === 0 ? (
                      <div className="bg-white/50 p-8 rounded-2xl border border-dashed border-black/10 text-center">
                        <p className="text-xs text-black/30 font-mono">
                          No new orders
                        </p>
                      </div>
                    ) : (
                      incomingOrders.map((order) => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-serif italic text-lg text-orange-900">
                                {order.customer_name
                                  ? `Guest: ${order.customer_name}`
                                  : `Table ${order.table_number}`}
                              </h4>
                              <p className="text-[10px] font-mono text-orange-600/60 uppercase">
                                Just arrived •{" "}
                                {new Date(
                                  order.created_at,
                                ).toLocaleTimeString()}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-mono uppercase tracking-wider animate-pulse">
                              New
                            </span>
                          </div>

                          <div className="space-y-1 mb-4 border-y border-orange-200/30 py-3">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-xs text-orange-800/80"
                              >
                                <span>
                                  {item.name} x {item.qty}
                                </span>
                                <span className="font-mono opacity-60">
                                  N$ {item.price * item.qty}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-3">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Est. Arrival (e.g. 20m)"
                                value={estArrival[order.id] || ""}
                                onChange={(e) =>
                                  setEstArrival({
                                    ...estArrival,
                                    [order.id]: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-orange-200 rounded-xl text-xs focus:outline-none focus:border-orange-400"
                              />
                            </div>
                            <button
                              onClick={() =>
                                updateOrderStatus(
                                  order.id,
                                  "Accepted",
                                  estArrival[order.id],
                                )
                              }
                              className="px-6 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
                            >
                              Accept
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {activeSubTab === "menu" && cart.length > 0 && (
          <div className="w-full lg:w-96 bg-white rounded-2xl border border-black/5 shadow-sm flex flex-col sticky bottom-0 lg:relative">
            <div className="p-6 border-bottom border-black/5">
              <h3 className="text-lg font-serif italic mb-4">Current Order</h3>
              <input
                type="text"
                placeholder="Table Number"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    <p className="font-medium">{item.item.name}</p>
                    <p className="text-xs text-black/40">
                      N$ {item.item.price} x {item.qty}
                    </p>
                  </div>
                  <p className="font-serif italic">
                    N$ {item.item.price * item.qty}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-6 bg-gray-50 rounded-b-2xl border-t border-black/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono uppercase text-black/40">
                  Total
                </span>
                <span className="text-xl font-serif italic">N$ {total}</span>
              </div>
              <button
                disabled={!table}
                onClick={handlePrintRequest}
                className="w-full py-3 sm:py-4 bg-[#141414] text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition-colors"
              >
                Print Receipt
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPrintConfirm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">Confirm Receipt</h3>
                <button
                  onClick={() => setShowPrintConfirm(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="border-b border-dashed border-black/10 pb-4">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-2">
                    Table {table}
                  </p>
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span>
                        {item.item.name} x {item.qty}
                      </span>
                      <span>N$ {item.item.price * item.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-serif italic text-lg">
                  <span>Total</span>
                  <span>N$ {total}</span>
                </div>
              </div>

              {!isConfirmed ? (
                <button
                  onClick={() => setIsConfirmed(true)}
                  className="w-full py-4 bg-black text-white rounded-xl font-medium"
                >
                  Confirm Details
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs text-center font-medium">
                    Details confirmed. Ready to print.
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Printer size={18} />
                    Print Now
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {isAdding && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">Add Menu Item</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Price (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newItem.price}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        price: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                {type === "Bar" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                        Cost Price (N$)
                      </label>
                      <input
                        type="number"
                        required
                        value={newItem.costPrice}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            costPrice: parseNumberInput(e.target.value),
                          })
                        }
                        className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                        Initial Stock
                      </label>
                      <input
                        type="number"
                        required
                        value={newItem.stock}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            stock: parseInt(e.target.value),
                          })
                        }
                        className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                        Min Stock Alert
                      </label>
                      <input
                        type="number"
                        required
                        value={newItem.minStock}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            minStock: parseInt(e.target.value),
                          })
                        }
                        className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                    placeholder="e.g. Main, Drinks, Starter"
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Save Item
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Modules ---
// RoomsModule moved to features/rooms/components/RoomsModule.tsx

const LaundryModule = ({
  orders,
  services,
  isAdmin,
  userRole,
  user,
  createNotification,
}: {
  orders: LaundryOrder[];
  services: any[];
  isAdmin: boolean;
  userRole?: string;
  user: User;
  createNotification: (notif: any) => Promise<void>;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"orders" | "services">(
    "orders",
  );

  const canManage = canManageLaundry(userRole as User["role"] | undefined);
  const [newOrder, setNewOrder] = useState({
    room_number: "",
    guest_name: "",
    total_price: 0,
    status: "Received" as any,
  });
  const [newService, setNewService] = useState({ name: "", price: 0 });
  const [cart, setCart] = useState<{ item: any; qty: number }[]>([]);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const total = cart.reduce((sum, i) => sum + i.item.price * i.qty, 0);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing)
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...prev, { item, qty: 1 }];
    });
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "laundry_orders"), {
        room_number: newOrder.room_number,
        guest_name: newOrder.guest_name,
        total_price: total,
        status: "Received",
        items: cart.map((c) => ({
          name: c.item.name,
          price: c.item.price,
          qty: c.qty,
        })),
        created_at: new Date().toISOString(),
      });

      // Notify staff
      await notifyRole({
        role: "Receptionist",
        title: "New Laundry Order",
        message: `New laundry order for ${sanitizeText(newOrder.guest_name, 80)} (Room ${sanitizeText(newOrder.room_number, 20)})`,
        type: "laundry",
      });
      setIsAdding(false);
      setCart([]);
      setNewOrder({
        room_number: "",
        guest_name: "",
        total_price: 0,
        status: "Received",
      });
      setShowPrintConfirm(false);
      setIsConfirmed(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "laundry_orders");
    }
  };

  const handlePrintRequest = () => {
    setShowPrintConfirm(true);
    setIsConfirmed(false);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "laundry_services"), newService);
      setIsAddingService(false);
      setNewService({ name: "", price: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, "laundry_orders", orderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "laundry_orders");
    }
  };

  const deleteService = async (serviceId: string) => {
    try {
      await deleteDoc(doc(db, "laundry_services", serviceId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "laundry_services");
    }
  };

  const updateStatus = async (
    id: string,
    status: string,
    estimatedArrival?: string,
  ) => {
    try {
      const updateData: any = { status };
      if (estimatedArrival) updateData.estimated_arrival = estimatedArrival;
      await updateDoc(doc(db, "laundry_orders", id), updateData);

      // Create notification for the guest
      const order = orders.find((o) => o.id === id);
      if (order && order.customer_email) {
        await notifyUser({
          userId: order.customer_uid,
          title: "Laundry Update",
          message: buildLaundryStatusMessage(
            sanitizeText(status, 30),
            estimatedArrival ? sanitizeText(estimatedArrival, 40) : undefined,
          ),
          type: "laundry",
          orderId: id,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "laundry_orders");
    }
  };

  const [estArrival, setEstArrival] = useState<{ [key: string]: string }>({});

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-auto lg:h-[calc(100vh-12rem)]">
      <div className="flex-1 space-y-8 overflow-y-auto pr-0 lg:pr-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-8">
            <h2 className="text-xl md:text-2xl font-serif italic">
              Laundry Service
            </h2>
            <div className="flex bg-white/50 p-1 rounded-xl border border-black/5 w-fit overflow-x-auto">
              <button
                onClick={() => setActiveSubTab("orders")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeSubTab === "orders" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
              >
                Orders
              </button>
              <button
                onClick={() => setActiveSubTab("services")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeSubTab === "services" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
              >
                Services
              </button>
            </div>
          </div>
          {activeSubTab === "orders" ? (
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-xs sm:text-sm font-medium w-full sm:w-auto"
            >
              New Laundry Order
            </button>
          ) : (
            canManage && (
              <button
                onClick={() => setIsAddingService(true)}
                className="px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-xs sm:text-sm font-medium w-full sm:w-auto"
              >
                Add Service Type
              </button>
            )
          )}
        </div>

        {activeSubTab === "orders" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm relative group"
              >
                {isAdmin && (
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="absolute top-4 right-4 p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-mono text-black/30 uppercase tracking-widest">
                      {order.room_number
                        ? `Room ${order.room_number}`
                        : `Guest: ${order.guest_name}`}
                    </p>
                    <h3 className="text-lg font-serif italic">
                      {order.guest_name}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-black/40">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {order.estimated_arrival && (
                  <p className="text-[10px] font-mono text-blue-600 uppercase mb-2">
                    Est. Delivery: {order.estimated_arrival}
                  </p>
                )}
                <div className="flex items-center justify-between mb-6">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider
                    ${order.status === "Delivered" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}
                  >
                    {order.status}
                  </span>
                  <p className="font-serif italic">N$ {order.total_price}</p>
                </div>
                <div className="space-y-2">
                  {canManage && (
                    <select
                      value={order.status}
                      onChange={(e) =>
                        updateStatus(
                          order.id,
                          e.target.value,
                          estArrival[order.id],
                        )
                      }
                      className="w-full p-2 bg-gray-50 border border-black/5 rounded-xl text-xs font-mono uppercase"
                    >
                      <option value="Received">Received</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Ready">Ready</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  )}
                  {order.status !== "Delivered" && (
                    <input
                      type="text"
                      placeholder="Est. Delivery (e.g. 2 hours)"
                      value={estArrival[order.id] || ""}
                      onChange={(e) =>
                        setEstArrival({
                          ...estArrival,
                          [order.id]: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-gray-50 border border-black/5 rounded-lg text-[10px] focus:outline-none"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {services.map((service) => (
              <motion.div
                key={service.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isAdmin && addToCart(service)}
                className="bg-white p-4 rounded-xl border border-black/5 shadow-sm flex justify-between items-center group text-left cursor-pointer"
              >
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-xs text-black/40 font-mono">
                    N$ {service.price}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteService(service.id);
                    }}
                    className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {!isAdmin && cart.length > 0 && (
        <div className="w-full lg:w-96 bg-white rounded-2xl border border-black/5 shadow-sm flex flex-col sticky bottom-0 lg:relative">
          <div className="p-6 border-bottom border-black/5">
            <h3 className="text-lg font-serif italic mb-4">Laundry Receipt</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Room Number"
                value={newOrder.room_number}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, room_number: e.target.value })
                }
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
              <input
                type="text"
                placeholder="Guest Name"
                value={newOrder.guest_name}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, guest_name: e.target.value })
                }
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center text-sm"
              >
                <div>
                  <p className="font-medium">{item.item.name}</p>
                  <p className="text-xs text-black/40">
                    N$ {item.item.price} x {item.qty}
                  </p>
                </div>
                <p className="font-serif italic">
                  N$ {item.item.price * item.qty}
                </p>
              </div>
            ))}
          </div>

          <div className="p-6 bg-gray-50 rounded-b-2xl border-t border-black/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase text-black/40">
                Total
              </span>
              <span className="text-xl font-serif italic">N$ {total}</span>
            </div>
            <button
              disabled={!newOrder.room_number || !newOrder.guest_name}
              onClick={handlePrintRequest}
              className="w-full py-3 sm:py-4 bg-[#141414] text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition-colors"
            >
              Print Receipt
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPrintConfirm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  Confirm Laundry Receipt
                </h3>
                <button
                  onClick={() => setShowPrintConfirm(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="border-b border-dashed border-black/10 pb-4">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-1">
                    Room {newOrder.room_number}
                  </p>
                  <p className="text-sm font-medium mb-4">
                    {newOrder.guest_name}
                  </p>
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span>
                        {item.item.name} x {item.qty}
                      </span>
                      <span>N$ {item.item.price * item.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-serif italic text-lg">
                  <span>Total</span>
                  <span>N$ {total}</span>
                </div>
              </div>

              {!isConfirmed ? (
                <button
                  onClick={() => setIsConfirmed(true)}
                  className="w-full py-4 bg-black text-white rounded-xl font-medium"
                >
                  Confirm Details
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs text-center font-medium">
                    Details confirmed. Ready to print.
                  </div>
                  <button
                    onClick={handleAddOrder}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Printer size={18} />
                    Print Now
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {isAdding && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">New Laundry Order</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddOrder} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.room_number}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, room_number: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Guest Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.guest_name}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, guest_name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Total Price (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newOrder.total_price}
                    onChange={(e) =>
                      setNewOrder({
                        ...newOrder,
                        total_price: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Create Order
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingService && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  Add Laundry Service
                </h3>
                <button
                  onClick={() => setIsAddingService(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddService} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newService.name}
                    onChange={(e) =>
                      setNewService({ ...newService, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Price (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newService.price}
                    onChange={(e) =>
                      setNewService({
                        ...newService,
                        price: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Save Service
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ConferenceModule = ({
  rooms,
  services,
  bookings,
  isAdmin,
  userRole,
  user,
  createNotification,
}: {
  rooms: any[];
  services: any[];
  bookings: any[];
  isAdmin: boolean;
  userRole?: string;
  user: User;
  createNotification: (notif: any) => Promise<void>;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    "facilities" | "services" | "bookings"
  >("facilities");

  const canManage = canManageConference(userRole as User["role"] | undefined);
  const [newRoom, setNewRoom] = useState({
    name: "",
    capacity: 0,
    price_per_hour: 0,
    status: "Available" as any,
  });
  const [newService, setNewService] = useState({ name: "", price: 0 });
  const [newBooking, setNewBooking] = useState({
    client_name: "",
    date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_time: "17:00",
    selectedServices: [] as string[],
  });
  const conferenceShowcase = LOCAL_ASSETS.showcase.conference[0];

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "conference_rooms"), newRoom);
      setIsAdding(false);
      setNewRoom({
        name: "",
        capacity: 0,
        price_per_hour: 0,
        status: "Available",
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "conference_rooms");
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "conference_services"), newService);
      setIsAddingService(false);
      setNewService({ name: "", price: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacility) return;

    try {
      const startTime = new Date(`${newBooking.date}T${newBooking.start_time}`);
      const endTime = new Date(`${newBooking.date}T${newBooking.end_time}`);
      const durationHours =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      let totalPrice = durationHours * selectedFacility.price_per_hour;

      // Add services price
      newBooking.selectedServices.forEach((serviceId) => {
        const service = services.find((s) => s.id === serviceId);
        if (service) totalPrice += service.price;
      });

      await addDoc(collection(db, "conference_bookings"), {
        room_id: selectedFacility.id,
        room_name: selectedFacility.name,
        client_name: newBooking.client_name,
        client_email: user?.email || "",
        client_uid: user?.id || "",
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        services: newBooking.selectedServices,
        total_price: totalPrice,
        status: "Pending",
      });

      // Notify staff
      await createNotification({
        role: "Receptionist",
        title: "New Conference Booking",
        message: `New booking for ${selectedFacility.name} by ${newBooking.client_name}`,
        type: "conference",
      });

      setIsBooking(false);
      setSelectedFacility(null);
      setNewBooking({
        client_name: "",
        date: new Date().toISOString().split("T")[0],
        start_time: "09:00",
        end_time: "17:00",
        selectedServices: [],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteFacility = async (id: string) => {
    try {
      await deleteDoc(doc(db, "conference_rooms", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "conference_rooms");
    }
  };

  const deleteService = async (id: string) => {
    try {
      await deleteDoc(doc(db, "conference_services", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "conference_services");
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      await deleteDoc(doc(db, "conference_bookings", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "conference_bookings");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-8">
          <h2 className="text-xl md:text-2xl font-serif italic">
            Conference Facilities
          </h2>
          <div className="flex bg-white/50 p-1 rounded-xl border border-black/5 w-fit overflow-x-auto">
            <button
              onClick={() => setActiveSubTab("facilities")}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeSubTab === "facilities" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Facilities
            </button>
            <button
              onClick={() => setActiveSubTab("bookings")}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeSubTab === "bookings" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveSubTab("services")}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeSubTab === "services" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Services
            </button>
          </div>
        </div>
        {activeSubTab === "facilities"
          ? canManage && (
              <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-xs sm:text-sm font-medium w-full sm:w-auto"
              >
                Add Facility
              </button>
            )
          : activeSubTab === "services"
            ? canManage && (
                <button
                  onClick={() => setIsAddingService(true)}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-xs sm:text-sm font-medium w-full sm:w-auto"
                >
                  Add Service
                </button>
              )
            : null}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-black/5 min-h-[260px] bg-white">
        <img
          src={conferenceShowcase}
          alt="Conference hall"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/10" />
        <div className="relative flex min-h-[260px] flex-col justify-end p-6 text-white">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/60">
            Meetings & Events
          </p>
          <h3 className="mt-2 text-3xl font-serif italic">
            Conference Facilities
          </h3>
          <p className="mt-2 max-w-xl text-sm text-white/80">
            The conference module now uses the on-site hall photography so the
            booking experience reflects the real venue.
          </p>
        </div>
      </div>

      {activeSubTab === "facilities" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm relative group"
            >
              <div className="mb-5 overflow-hidden rounded-2xl border border-black/5 bg-[#F5F5F0] aspect-[4/3]">
                <img
                  src={conferenceShowcase}
                  alt={room.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              {canManage && (
                <button
                  onClick={() => deleteFacility(room.id)}
                  className="absolute top-4 right-4 p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                >
                  <X size={16} />
                </button>
              )}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-mono text-black/30 uppercase tracking-widest">
                    Capacity: {room.capacity} pax
                  </p>
                  <h3 className="text-xl font-serif italic">{room.name}</h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider
                  ${room.status === "Available" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}
                >
                  {room.status}
                </span>
              </div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs text-black/40">Rate</span>
                <span className="font-serif italic">
                  N$ {room.price_per_hour} / hour
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedFacility(room);
                  setIsBooking(true);
                }}
                className="w-full py-3 bg-gray-50 border border-black/5 rounded-xl text-xs font-mono uppercase tracking-widest hover:bg-black hover:text-white transition-all"
              >
                Book Facility
              </button>
            </div>
          ))}
        </div>
      ) : activeSubTab === "bookings" ? (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-black/5">
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Facility
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Client
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Time
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Total
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Status
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-black/5 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="p-6 font-medium">{booking.room_name}</td>
                  <td className="p-6 text-sm">{booking.client_name}</td>
                  <td className="p-6 text-xs font-mono">
                    {new Date(booking.start_time).toLocaleDateString()} <br />
                    {new Date(booking.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -
                    {new Date(booking.end_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-6 font-serif italic">
                    N$ {booking.total_price}
                  </td>
                  <td className="p-6">
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-mono uppercase
                      ${booking.status === "Confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-700"}`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    {canManage && (
                      <button
                        onClick={() => deleteBooking(booking.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white p-4 rounded-xl border border-black/5 shadow-sm flex justify-between items-center group"
            >
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-xs text-black/40 font-mono">
                  N$ {service.price}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => deleteService(service.id)}
                  className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isBooking && selectedFacility && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  Book {selectedFacility.name}
                </h3>
                <button
                  onClick={() => setIsBooking(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleBooking} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newBooking.client_name}
                    onChange={(e) =>
                      setNewBooking({
                        ...newBooking,
                        client_name: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newBooking.date}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, date: e.target.value })
                      }
                      className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={newBooking.start_time}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          start_time: e.target.value,
                        })
                      }
                      className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newBooking.end_time}
                    onChange={(e) =>
                      setNewBooking({ ...newBooking, end_time: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-2">
                    Additional Services
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {services.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={newBooking.selectedServices.includes(
                            service.id,
                          )}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...newBooking.selectedServices, service.id]
                              : newBooking.selectedServices.filter(
                                  (id) => id !== service.id,
                                );
                            setNewBooking({
                              ...newBooking,
                              selectedServices: next,
                            });
                          }}
                          className="rounded border-black/10 text-black focus:ring-black"
                        />
                        <span className="text-sm">
                          {service.name} (N$ {service.price})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Confirm Booking
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAdding && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  Add Conference Facility
                </h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddRoom} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoom.name}
                    onChange={(e) =>
                      setNewRoom({ ...newRoom, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    required
                    value={newRoom.capacity}
                    onChange={(e) =>
                      setNewRoom({
                        ...newRoom,
                        capacity: parseInt(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Price per Hour (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newRoom.price_per_hour}
                    onChange={(e) =>
                      setNewRoom({
                        ...newRoom,
                        price_per_hour: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Save Facility
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingService && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  Add Conference Service
                </h3>
                <button
                  onClick={() => setIsAddingService(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddService} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newService.name}
                    onChange={(e) =>
                      setNewService({ ...newService, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Price (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newService.price}
                    onChange={(e) =>
                      setNewService({
                        ...newService,
                        price: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Save Service
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StaffModule = ({ users }: { users: User[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "Waiter" as any,
  });

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    let secondaryApp;
    try {
      // 1. Create user in Firebase Auth using a secondary app instance
      // This prevents the current admin from being signed out
      try {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryAuth");
      } catch (e) {
        secondaryApp = getApp("SecondaryAuth");
      }

      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newStaff.email,
        newStaff.password,
      );
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      // 2. Save user details to Firestore
      // Use UID as the document ID for consistency and security
      const { password: _password, ...staffData } = newStaff;
      await setDoc(doc(db, "users", userCredential.user.uid), {
        ...staffData,
      });

      setIsAdding(false);
      setNewStaff({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "Waiter",
      });
      alert(
        "Staff member registered successfully. They can now log in with their email and password.",
      );
    } catch (err: any) {
      console.error("Registration error:", err);
      alert("Failed to register staff: " + err.message);
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {}
      }
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    }
  };

  const deleteStaff = async (userId: string) => {
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "users");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-serif italic">
          Staff Management
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all w-full sm:w-auto text-xs sm:text-sm font-medium"
        >
          <Plus size={16} />
          <span>Add Staff</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-black/5">
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                Name
              </th>
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                Username
              </th>
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                Role
              </th>
              <th className="p-6 text-[10px] font-mono uppercase text-black/40 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((staff) => (
              <tr
                key={staff.id}
                className="border-b border-black/5 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <td className="p-6">
                  <p className="font-medium">{staff.name}</p>
                  <p className="text-[10px] font-mono text-black/30">
                    {staff.email}
                  </p>
                </td>
                <td className="p-6 text-sm font-mono">{staff.username}</td>
                <td className="p-6">
                  <select
                    value={staff.role}
                    onChange={(e) => updateRole(staff.id, e.target.value)}
                    className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Waiter">Waiter</option>
                    <option value="Barman">Barman</option>
                    <option value="Laundry">Laundry</option>
                  </select>
                </td>
                <td className="p-6 text-right">
                  <button
                    onClick={() => deleteStaff(staff.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">Add New Staff</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.name}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.username}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, username: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, email: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newStaff.password}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, password: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Role
                  </label>
                  <select
                    value={newStaff.role}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, role: e.target.value as any })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Waiter">Waiter</option>
                    <option value="Barman">Barman</option>
                    <option value="Laundry">Laundry</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Register Staff
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CustomerPortal = ({
  user,
  notifications: globalHotelNotifications,
  markHotelNotificationAsRead,
  createNotification,
  rooms,
  menu,
  laundryServices,
  conferenceRooms,
  conferenceServices,
  myOrders,
  myLaundryOrders,
  myRoomBookings,
  myConferenceBookings,
  globalPreferences,
}: {
  user: User;
  notifications: HotelNotification[];
  markHotelNotificationAsRead: (id: string) => Promise<void>;
  createNotification: (notif: any) => Promise<void>;
  rooms: Room[];
  menu: MenuItem[];
  laundryServices: LaundryService[];
  conferenceRooms: ConferenceRoom[];
  conferenceServices: ConferenceService[];
  myOrders: Order[];
  myLaundryOrders: LaundryOrder[];
  myRoomBookings: any[];
  myConferenceBookings: any[];
  globalPreferences?: any[];
}) => {
  const HERO_SLIDE_INTERVAL_MS = 4000;
  const HERO_TRANSITION_SECONDS = 0.55;
  const [activeTab, setActiveTab] = useState(() =>
    getRouteHashTab("portal", PORTAL_ROUTE_TABS, "home"),
  );
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [includeBreakfast, setIncludeBreakfast] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHotelNotifications, setShowHotelNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<
    { id: string; message: string; type: "info" | "success" | "error" }[]
  >([]);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [heroImagesReady, setHeroImagesReady] = useState(false);

  const heroImages = LOCAL_ASSETS.hero;

  useEffect(() => {
    let isMounted = true;

    const preloadImages = async () => {
      try {
        await Promise.all(
          heroImages.map(
            (src) =>
              new Promise<void>((resolve) => {
                const image: HTMLImageElement = new window.Image();
                const complete = () => resolve();
                image.onload = complete;
                image.onerror = complete;
                image.src = src;

                if ("decode" in image) {
                  image.decode().then(complete).catch(complete);
                }
              }),
          ),
        );
      } finally {
        if (isMounted) {
          setHeroImagesReady(true);
        }
      }
    };

    preloadImages();

    return () => {
      isMounted = false;
    };
  }, [heroImages]);

  useEffect(() => {
    if (!heroImagesReady) return;

    const timer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [heroImages.length, heroImagesReady]);

  const addToast = (
    message: string,
    type: "info" | "success" | "error" = "info",
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const placeOrder = async (item: MenuItem) => {
    try {
      const orderRef = await addDoc(collection(db, "orders"), {
        customer_email: user.email,
        customer_name: user.name,
        customer_uid: user.id,
        items: [{ ...item, quantity: 1 }],
        total_price: item.price,
        status: "Pending",
        type: item.type,
        created_at: new Date().toISOString(),
      });

      // Notify staff when rules permit it, but do not fail the customer action if the notification write is rejected.
      try {
        await createNotification({
          role: item.type === "Restaurant" ? "Waiter" : "Barman",
          title: `New ${item.type} Order`,
          message: `New order from ${user.name} for ${item.name}`,
          type: "order",
          orderId: orderRef.id,
        });
      } catch (notificationError) {
        console.warn("Order notification failed:", notificationError);
      }

      addToast("Order placed successfully!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to place order", "error");
    }
  };

  const handleRoomCheckIn = async (
    room: Room,
    options: { includeBreakfast: boolean; selectedAddons: string[] },
  ) => {
    console.log("Check-in attempt by:", user?.id, "isAuthenticated:", !!user);
    try {
      const addonFromRoom = (room.additionalServices || [])
        .filter((s) => options.selectedAddons.includes(s.name))
        .reduce((sum, s) => sum + s.price, 0);
      const addonFromGlobal = (globalPreferences || [])
        .filter((s) => options.selectedAddons.includes(s.name))
        .reduce((sum, s) => sum + s.price, 0);
      const finalPrice =
        room.price +
        (options.includeBreakfast ? room.breakfastPrice || 0 : 0) +
        addonFromRoom +
        addonFromGlobal;

      await addDoc(collection(db, "room_bookings"), {
        room_id: room.id,
        room_number: room.number,
        guest_uid: user.id,
        guest_name: user.name,
        guest_email: user.email,
        total_price: finalPrice,
        breakfast_included: options.includeBreakfast,
        additional_services: options.selectedAddons,
        status: "Pending",
        check_in: new Date().toISOString(),
        check_out: new Date(new Date().getTime() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      });

      // Notify receptionist when rules permit it, but keep the booking successful even if the notification write is rejected.
      try {
        await createNotification({
          role: "Receptionist",
          title: "New Check-In Request",
          message: `${user.name} checked into Room ${room.number} with ${options.includeBreakfast ? "breakfast" : "no breakfast"}${options.selectedAddons.length > 0 ? " and extra services" : ""}`,
          type: "system",
          targetTab: "rooms",
        });
      } catch (notificationError) {
        console.warn("Check-in notification failed:", notificationError);
      }

      addToast(
        "Check-in request submitted! Total: N$ " + finalPrice,
        "success",
      );
      setSelectedRoom(null);
    } catch (err) {
      console.error(err);
      addToast("Check-in failed", "error");
    }
  };

  const placeLaundryOrder = async (service: LaundryService) => {
    try {
      const orderRef = await addDoc(collection(db, "laundry_orders"), {
        customer_email: user.email,
        guest_name: user.name,
        customer_uid: user.id,
        items: [{ ...service, quantity: 1 }],
        total_price: service.price,
        status: "Received",
        created_at: new Date().toISOString(),
      });

      // Notify staff when rules permit it, but do not fail the customer action if the notification write is rejected.
      try {
        await createNotification({
          role: "Receptionist",
          title: "New Laundry Request",
          message: `New laundry request from ${user.name}`,
          type: "laundry",
          orderId: orderRef.id,
        });
      } catch (notificationError) {
        console.warn("Laundry notification failed:", notificationError);
      }

      addToast("Laundry request sent!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to send request", "error");
    }
  };

  const lastStatuses = useRef<{ [key: string]: string }>({});
  const isInitialLoad = useRef(true);

  useEffect(() => {
    NotificationService.requestPermission();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextTab = getRouteHashTab("portal", PORTAL_ROUTE_TABS, activeTab);
      setActiveTab((currentTab) =>
        currentTab === nextTab ? currentTab : nextTab,
      );
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab]);

  useEffect(() => {
    syncRouteHashTab("portal", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const allOrders = [...myOrders, ...myLaundryOrders];
    allOrders.forEach((order) => {
      const prevStatus = lastStatuses.current[order.id];
      if (prevStatus && prevStatus !== order.status) {
        const type =
          "type" in order ? `${order.type} Order` : "Laundry Service";
        const message = `${type} status updated to: ${order.status}`;
        const id = Math.random().toString(36).substr(2, 9);

        setToasts((prev) => [...prev, { id, message, type: "success" }]);

        // Push HotelNotification
        NotificationService.notify("Order Update", {
          body: message,
          tag: order.id,
        });

        // Auto-remove notification after 5 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
      }
      lastStatuses.current[order.id] = order.status;
    });
    isInitialLoad.current = false;
  }, [myOrders, myLaundryOrders]);

  const getRoomImage = (room: Room) => {
    if (
      room.imageUrl &&
      !room.imageUrl.includes("pexels.com") &&
      !room.imageUrl.includes("picsum.photos") &&
      !room.imageUrl.startsWith("/rooms/")
    ) {
      return room.imageUrl;
    }

    return getDefaultRoomImage(room);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center font-mono">
        Loading Portal...
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F5F5F4] flex flex-col">
      {/* HotelNotifications Overlay */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-black text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 pointer-events-auto min-w-[300px]"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Bell size={16} className="text-white" />
              </div>
              <p className="text-sm font-medium">{n.message}</p>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((notif) => notif.id !== n.id))
                }
                className="ml-auto p-1 hover:bg-white/10 rounded-lg"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-black/5 p-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-xl font-serif italic">Pahukeni Portal</h1>
            <div className="hidden md:flex items-center gap-1 text-[10px] font-mono uppercase text-black/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Guest Access
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() =>
                  setShowHotelNotifications(!showHotelNotifications)
                }
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
              >
                <Bell size={20} className="text-black/60" />
                {globalHotelNotifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              <AnimatePresence>
                {showHotelNotifications && (
                  <div className="absolute right-0 mt-2 w-80 z-50">
                    <NotificationCenterPanel
                      notifications={globalHotelNotifications}
                      onClose={() => setShowHotelNotifications(false)}
                      onMarkAsRead={markHotelNotificationAsRead}
                      onNavigate={(type, title) => {
                        if (type === "order") setActiveTab("orders");
                        if (type === "laundry") setActiveTab("laundry");
                        if (type === "conference") setActiveTab("conference");
                      }}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-xs font-mono text-black/60 hidden sm:block">
              {user.name}
            </span>
            <button
              onClick={() => signOut(auth)}
              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Mobile Menu Drawer */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-white z-40 p-6 shadow-2xl lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-serif italic">Menu</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-2 flex-1">
                {[
                  { id: "home", label: "Home", icon: HomeIcon },
                  { id: "rooms", label: "Rooms", icon: Bed },
                  { id: "dining", label: "Dining", icon: Utensils },
                  { id: "laundry", label: "Laundry", icon: WashingMachine },
                  { id: "conference", label: "Conference", icon: Users },
                  { id: "orders", label: "My Orders", icon: ClipboardList },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                      activeTab === item.id
                        ? "bg-black text-white shadow-lg shadow-black/10"
                        : "bg-white text-black/60 hover:bg-gray-50 border border-black/5"
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="pt-6 border-t border-black/5">
                <button
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center gap-3 p-4 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut size={18} />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block lg:col-span-1 space-y-2">
          {[
            { id: "home", label: "Home", icon: HomeIcon },
            { id: "rooms", label: "Rooms", icon: Bed },
            { id: "dining", label: "Dining", icon: Utensils },
            { id: "laundry", label: "Laundry", icon: WashingMachine },
            { id: "conference", label: "Conference", icon: Users },
            { id: "orders", label: "My Orders", icon: ClipboardList },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                activeTab === item.id
                  ? "bg-black text-white shadow-lg shadow-black/10"
                  : "bg-white text-black/60 hover:bg-gray-50 border border-black/5"
              }`}
            >
              <item.icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-3">
          <AnimatePresence initial={false} mode="sync">
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-8"
              >
                <div className="relative h-[400px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl group">
                  {heroImages.map((image, idx) => (
                    <motion.img
                      key={image}
                      src={image}
                      alt="Pahukeni guest experience"
                      initial={false}
                      animate={{
                        opacity: idx === currentHeroIndex ? 1 : 0,
                        scale: idx === currentHeroIndex ? 1 : 1.015,
                      }}
                      transition={{
                        opacity: {
                          duration: heroImagesReady
                            ? HERO_TRANSITION_SECONDS
                            : 0.2,
                          ease: "easeOut",
                        },
                        scale: {
                          duration: heroImagesReady
                            ? HERO_TRANSITION_SECONDS
                            : 0.2,
                          ease: "easeOut",
                        },
                      }}
                      className="absolute inset-0 w-full h-full object-cover brightness-75 will-change-[opacity,transform]"
                      loading={idx === 0 ? "eager" : "lazy"}
                      fetchPriority={idx === 0 ? "high" : "auto"}
                      draggable={false}
                    />
                  ))}

                  {!heroImagesReady && (
                    <div className="absolute inset-0 bg-black/40 animate-pulse" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-12">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <h2 className="text-4xl md:text-6xl font-serif italic text-white mb-4 tracking-tight">
                        Welcome back, {user.name}
                      </h2>
                      <p className="text-white/80 max-w-xl text-sm md:text-base leading-relaxed font-light">
                        Experience the finest hospitality at Pahukeni Pension.
                        Your sanctuary of comfort and refined living awaits.
                      </p>
                    </motion.div>

                    <div className="flex gap-2 mt-8">
                      {heroImages.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1 rounded-full transition-all duration-300 ${idx === currentHeroIndex ? "w-8 bg-white" : "w-2 bg-white/30"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center text-center group hover:bg-black hover:text-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-full bg-black/5 group-hover:bg-white/10 flex items-center justify-center mb-4 transition-colors">
                      <Utensils size={24} />
                    </div>
                    <h3 className="text-lg font-serif italic mb-2">
                      Fine Dining
                    </h3>
                    <p className="text-sm opacity-60 mb-6">
                      Order exquisite meals directly to your room.
                    </p>
                    <button
                      onClick={() => setActiveTab("dining")}
                      className="text-xs font-mono uppercase tracking-widest border-b border-current pb-1"
                    >
                      Explore Menu
                    </button>
                  </div>

                  <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center text-center group hover:bg-black hover:text-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-full bg-black/5 group-hover:bg-white/10 flex items-center justify-center mb-4 transition-colors">
                      <WashingMachine size={24} />
                    </div>
                    <h3 className="text-lg font-serif italic mb-2">
                      Laundry Service
                    </h3>
                    <p className="text-sm opacity-60 mb-6">
                      Professional care for your finest garments.
                    </p>
                    <button
                      onClick={() => setActiveTab("laundry")}
                      className="text-xs font-mono uppercase tracking-widest border-b border-current pb-1"
                    >
                      Request Service
                    </button>
                  </div>

                  <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center text-center group hover:bg-black hover:text-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-full bg-black/5 group-hover:bg-white/10 flex items-center justify-center mb-4 transition-colors">
                      <Users size={24} />
                    </div>
                    <h3 className="text-lg font-serif italic mb-2">
                      Conferences
                    </h3>
                    <p className="text-sm opacity-60 mb-6">
                      World-class facilities for your business needs.
                    </p>
                    <button
                      onClick={() => setActiveTab("conference")}
                      className="text-xs font-mono uppercase tracking-widest border-b border-current pb-1"
                    >
                      Book a Room
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <h3 className="text-2xl font-serif italic">
                      Curated Spaces
                    </h3>
                    <button
                      onClick={() => setActiveTab("rooms")}
                      className="text-xs font-mono uppercase text-black/40 hover:text-black transition-colors flex items-center gap-1"
                    >
                      View All Rooms <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {rooms.slice(0, 3).map((room) => (
                      <div
                        key={room.id}
                        onClick={() => {
                          setSelectedRoom(room);
                          setActiveTab("rooms");
                        }}
                        className="group cursor-pointer bg-white rounded-3xl p-4 border border-black/5 shadow-sm hover:shadow-xl transition-all"
                      >
                        <div className="aspect-[4/5] rounded-2xl overflow-hidden mb-6 relative shadow-md bg-black">
                          <img
                            src={getRoomImage(room)}
                            alt={room.category}
                            className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-60 transition-all duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 bg-white text-black font-black rounded text-[9px] font-mono uppercase tracking-[0.3em]">
                                  {room.number.match(/^[A-Z]+/)?.[0] || "RM"}
                                </span>
                                <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest border-l border-white/20 pl-3">
                                  REGISTRY
                                </span>
                              </div>
                              <p className="text-white text-7xl font-serif font-black tracking-tighter leading-none">
                                {room.number.replace(/^[A-Z]+/, "")}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-black/30 mb-1">
                              Standard Suite
                            </span>
                            <h4 className="text-base font-serif font-bold text-[#141414] tracking-tight italic">
                              Registry Unit {room.number}
                            </h4>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-black/30 mb-1">
                              Stay Value
                            </span>
                            <p className="text-lg font-serif font-black text-[#141414]">
                              N$ {room.price}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "rooms" && (
              <motion.div
                key="rooms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                <div className="relative h-64 rounded-3xl overflow-hidden mb-12 shadow-lg">
                  <img
                    src={LOCAL_ASSETS.hero[1]}
                    alt="Luxury Living"
                    className="w-full h-full object-cover brightness-50"
                  />
                  <div className="absolute inset-0 flex flex-col justify-center p-12">
                    <h2 className="text-5xl md:text-7xl font-serif italic text-white mb-4 tracking-tighter">
                      Our Rooms
                    </h2>
                    <p className="text-white/70 max-w-md font-mono uppercase text-[10px] tracking-widest">
                      Curated spaces designed for ultimate comfort and refined
                      living.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm group"
                    >
                      <div className="aspect-video overflow-hidden relative">
                        <img
                          src={getRoomImage(room)}
                          alt={`Room ${room.number}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-mono uppercase tracking-wider">
                          {room.category}
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="px-2 py-0.5 bg-black/[0.04] border border-black/5 rounded-[4px] text-[8px] font-mono text-black/40 font-bold uppercase tracking-widest shadow-inner">
                                {room.number.match(/^[A-Z]+/)?.[0] || "RM"}
                              </span>
                              <span className="text-[10px] font-mono text-black/20 font-medium uppercase tracking-[0.2em] border-l border-black/5 pl-2">
                                UNIT REGISTRY
                              </span>
                            </div>
                            <h3 className="text-4xl font-serif font-black tracking-tight text-[#141414] leading-none mb-1">
                              {room.number.replace(/^[A-Z]+/, "")}
                            </h3>
                            <p
                              className={`text-[9px] font-mono font-medium uppercase tracking-[0.15em] ${
                                room.status === "Available"
                                  ? "text-emerald-600"
                                  : "text-orange-600"
                              }`}
                            >
                              {room.category} Standard • {room.status}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-serif font-black text-[#141414]">
                              N$ {room.price}
                            </p>
                            <p className="text-[9px] text-black/30 font-mono font-medium uppercase tracking-widest">
                              Base Nightly Rate
                            </p>
                          </div>
                        </div>

                        {room.description && (
                          <p className="text-sm text-black/60 line-clamp-2 mb-4 h-10">
                            {room.description}
                          </p>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={() => setSelectedRoom(room)}
                            className="flex-1 py-3 bg-white border border-black/10 text-black rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            View Details
                          </button>
                          <button
                            disabled={room.status !== "Available"}
                            className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-black/90 transition-colors"
                          >
                            {room.status === "Available"
                              ? "Book Now"
                              : "Unavailable"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "dining" && (
              <motion.div
                key="dining"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {menu.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-2xl border border-black/5 flex gap-4 shadow-sm"
                    >
                      <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          src={getMenuImage(item)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-serif italic">{item.name}</h3>
                            <span className="text-sm font-serif italic">
                              N$ {item.price}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-black/40 uppercase mt-1">
                            {item.category} • {item.type}
                          </p>
                        </div>
                        <button
                          onClick={() => placeOrder(item)}
                          disabled={item.status === "Out of Stock"}
                          className="mt-2 text-xs font-mono uppercase text-emerald-600 hover:text-emerald-700 font-bold disabled:text-black/20"
                        >
                          {item.status === "Available"
                            ? "+ Add to Order"
                            : "Out of Stock"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "laundry" && (
              <motion.div
                key="laundry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                  <h2 className="text-xl font-serif italic mb-6">
                    Laundry Services
                  </h2>
                  <div className="space-y-4">
                    {laundryServices.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-black/5"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white rounded-lg border border-black/5">
                            <WashingMachine
                              size={16}
                              className="text-black/40"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {service.name}
                            </p>
                            <p className="text-[10px] font-mono text-black/40 uppercase">
                              Professional Cleaning
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-serif italic">
                            N$ {service.price}
                          </span>
                          <button
                            onClick={() => placeLaundryOrder(service)}
                            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-medium hover:bg-black/90 transition-colors"
                          >
                            Request
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "conference" && (
              <motion.div
                key="conference"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {conferenceRooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-serif italic">
                            {room.name}
                          </h3>
                          <p className="text-xs text-black/40 font-mono uppercase">
                            Capacity: {room.capacity} People
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-serif italic">
                            N$ {room.price_per_hour}
                          </p>
                          <p className="text-[10px] text-black/40 font-mono uppercase">
                            per hour
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-xs text-black/60">
                          <CheckCircle2
                            size={14}
                            className="text-emerald-500"
                          />
                          <span>High-speed WiFi</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-black/60">
                          <CheckCircle2
                            size={14}
                            className="text-emerald-500"
                          />
                          <span>Air Conditioning</span>
                        </div>
                      </div>
                      <button className="w-full py-3 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                        Inquire for Booking
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                  <h2 className="text-xl font-serif italic mb-6">
                    Additional Services
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {conferenceServices.map((service) => (
                      <div
                        key={service.id}
                        className="p-4 bg-gray-50 rounded-xl border border-black/5"
                      >
                        <p className="text-sm font-medium mb-1">
                          {service.name}
                        </p>
                        <p className="text-xs font-serif italic text-black/40">
                          N$ {service.price}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "orders" && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                  <h2 className="text-xl font-serif italic mb-6">
                    Recent Orders
                  </h2>
                  <div className="space-y-4">
                    {[...myOrders, ...myLaundryOrders]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime(),
                      )
                      .map((order) => (
                        <div
                          key={order.id}
                          className="p-4 bg-gray-50 rounded-xl border border-black/5 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-2 rounded-lg ${
                                order.status === "Completed" ||
                                order.status === "Delivered"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : order.status === "Accepted" ||
                                      order.status === "Preparing"
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              <Clock size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {"type" in order
                                  ? `${order.type} Order`
                                  : "Laundry Service"}
                              </p>
                              <p className="text-[10px] font-mono text-black/40 uppercase">
                                {new Date(order.created_at).toLocaleString()}
                              </p>
                              {order.estimated_arrival && (
                                <p className="text-[10px] font-mono text-blue-600 uppercase mt-1 font-bold">
                                  Est.{" "}
                                  {"type" in order ? "Arrival" : "Delivery"}:{" "}
                                  {order.estimated_arrival}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-serif italic">
                              N$ {order.total_price}
                            </p>
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                                order.status === "Completed" ||
                                order.status === "Delivered"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : order.status === "Accepted" ||
                                      order.status === "Preparing"
                                    ? "bg-blue-600 text-white animate-pulse"
                                    : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    {myOrders.length === 0 && myLaundryOrders.length === 0 && (
                      <p className="text-center py-8 text-black/20 font-mono text-sm">
                        No orders yet
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {selectedRoom && (
            <RoomDetailsModal
              selectedRoom={selectedRoom}
              onClose={() => setSelectedRoom(null)}
              onCheckIn={handleRoomCheckIn}
              globalPreferences={globalPreferences}
              getRoomImage={getRoomImage}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [toasts, setToasts] = useState<
    { id: string; message: string; type: "success" | "error" | "info" }[]
  >([]);

  const addToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const [activeTab, setActiveTab] = useState(() =>
    getRouteHashTab("staff", STAFF_ROUTE_TABS, "dashboard"),
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Push notifications: initialize and manage token lifecycle
  // Reads VAPID key from VITE_FIREBASE_VAPID_KEY if provided at build time
  usePushNotifications(process.env.VITE_FIREBASE_VAPID_KEY);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [laundry, setLaundry] = useState<LaundryOrder[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [conferenceRooms, setConferenceRooms] = useState<any[]>([]);
  const [laundryServices, setLaundryServices] = useState<any[]>([]);
  const [conferenceServices, setConferenceServices] = useState<any[]>([]);
  const [conferenceBookings, setConferenceBookings] = useState<any[]>([]);
  const [globalPreferences, setGlobalPreferences] = useState<any[]>([]);
  const [notifications, setHotelNotifications] = useState<HotelNotification[]>(
    [],
  );
  const [showHotelNotifications, setShowHotelNotifications] = useState(false);
  const lastOrdersCount = useRef<number | null>(null);
  const lastLaundryCount = useRef<number | null>(null);
  const lastBookingCount = useRef<number | null>(null);

  useEffect(() => {
    NotificationService.requestPermission();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextTab = getRouteHashTab("staff", STAFF_ROUTE_TABS, activeTab);
      setActiveTab((currentTab) =>
        currentTab === nextTab ? currentTab : nextTab,
      );
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab]);

  useEffect(() => {
    if (user && user.role !== "Customer") {
      syncRouteHashTab("staff", activeTab);
    }
  }, [activeTab, user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setUser(await resolveUserProfile(firebaseUser));
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // Don't sign out immediately, maybe it's a transient firestore error
          // But if it's persistent, we might need to handle it
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const isStaff = isStaffRole(user?.role);

  // Real-time listeners
  useEffect(() => {
    if (!user) return;

    const unsubRooms = onSnapshot(
      collection(db, "rooms"),
      (snapshot) => {
        setRooms(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Room),
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, "rooms"),
    );

    const unsubMenu = onSnapshot(
      collection(db, "menu_items"),
      (snapshot) => {
        setMenu(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as MenuItem,
          ),
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, "menu_items"),
    );

    // Role-aware queries for orders
    const ordersQuery = isStaff
      ? collection(db, "orders")
      : query(collection(db, "orders"), where("customer_uid", "==", user.id));

    const unsubOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const newOrders = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Order,
        );
        setOrders(newOrders);

        // FRONTEND-ONLY TRIGGER: Notify staff of new incoming orders locally
        if (
          lastOrdersCount.current !== null &&
          newOrders.length > lastOrdersCount.current
        ) {
          const latest = [...newOrders].sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )[0];

          if (latest && latest.status === "Pending") {
            const isRelevant = canReceiveOrderNotifications(
              latest.type,
              user.role,
            );

            if (isRelevant) {
              // Trigger local UI Toast
              addToast(`New ${latest.type} Order Received!`, "info");

              // Trigger Browser-level notification (if permission granted)
              if (
                window.Notification &&
                window.Notification.permission === "granted"
              ) {
                new window.Notification(`New ${latest.type} Order`, {
                  body: `Table ${latest.table_number || "N/A"} placed an order for N$ ${latest.total_price}`,
                  icon: "/assets/images/logo/pahukeni_logo.png",
                });
              }
            }
          }
        }
        lastOrdersCount.current = newOrders.length;
      },
      (error) => handleFirestoreError(error, OperationType.GET, "orders"),
    );

    // Role-aware queries for laundry
    const laundryQuery = isStaff
      ? collection(db, "laundry_orders")
      : query(
          collection(db, "laundry_orders"),
          where("customer_uid", "==", user.id),
        );

    const unsubLaundry = onSnapshot(
      laundryQuery,
      (snapshot) => {
        const newLaundry = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as LaundryOrder,
        );
        setLaundry(newLaundry);

        if (
          lastLaundryCount.current !== null &&
          newLaundry.length > lastLaundryCount.current
        ) {
          const isRelevant = canReceiveFrontDeskNotifications(user.role);
          if (isRelevant) {
            NotificationService.notify("New Laundry Request", {
              body: "A new laundry service request has been received.",
              tag: "new-laundry",
            });
          }
        }
        lastLaundryCount.current = newLaundry.length;
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "laundry_orders"),
    );

    // Role-aware queries for room bookings
    const bookingsQuery = isStaff
      ? collection(db, "room_bookings")
      : query(
          collection(db, "room_bookings"),
          where("guest_uid", "==", user.id),
        );

    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        setBookings(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "room_bookings"),
    );

    let unsubUsers = () => {};
    if (canManageStaff(user.role)) {
      unsubUsers = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          setUsers(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User),
          );
        },
        (error) => handleFirestoreError(error, OperationType.GET, "users"),
      );
    }

    const unsubConf = onSnapshot(
      collection(db, "conference_rooms"),
      (snapshot) => {
        setConferenceRooms(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "conference_rooms"),
    );

    const unsubLaundryServices = onSnapshot(
      collection(db, "laundry_services"),
      (snapshot) => {
        setLaundryServices(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "laundry_services"),
    );

    const unsubConfServices = onSnapshot(
      collection(db, "conference_services"),
      (snapshot) => {
        setConferenceServices(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "conference_services"),
    );

    // Role-aware queries for conference bookings
    const confBookingsQuery = isStaff
      ? collection(db, "conference_bookings")
      : query(
          collection(db, "conference_bookings"),
          where("client_uid", "==", user.id),
        );

    const unsubConfBookings = onSnapshot(
      confBookingsQuery,
      (snapshot) => {
        const newBookings = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setConferenceBookings(newBookings);

        if (
          lastBookingCount.current !== null &&
          newBookings.length > lastBookingCount.current
        ) {
          const isRelevant = canReceiveFrontDeskNotifications(user.role);
          if (isRelevant) {
            NotificationService.notify("New Conference Booking", {
              body: "A new conference room booking request has been received.",
              tag: "new-conference",
            });
          }
        }
        lastBookingCount.current = newBookings.length;
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "conference_bookings"),
    );

    // Listen to persistent notifications
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.id),
      orderBy("created_at", "desc"),
    );
    const unsubNotifs = onSnapshot(
      q,
      (snapshot) => {
        const personalNotifs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as HotelNotification,
        );
        setHotelNotifications((prev) => {
          const unique = dedupeById([...prev, ...personalNotifs]);

          // Trigger browser notification for new unread ones
          personalNotifs
            .filter((n) => !n.read)
            .forEach((n) => {
              const age = Date.now() - new Date(n.created_at).getTime();
              if (age < 10000) {
                NotificationService.notify(n.title, {
                  body: n.message,
                  tag: n.id,
                });
              }
            });

          return unique.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
        });
      },
      (error) => {
        // If query fails (e.g. index missing), fallback to non-filtered or just log
        console.warn("HotelNotification listener failed:", error);
      },
    );

    // Also listen to role-based notifications
    const qRole = query(
      collection(db, "notifications"),
      where("role", "==", user.role),
      orderBy("created_at", "desc"),
    );
    const unsubRoleNotifs = onSnapshot(
      qRole,
      (snapshot) => {
        const roleNotifs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as HotelNotification,
        );
        setHotelNotifications((prev) => {
          const unique = dedupeById([...prev, ...roleNotifs]);

          // Trigger browser notification for new unread ones
          roleNotifs
            .filter((n) => !n.read)
            .forEach((n) => {
              const age = Date.now() - new Date(n.created_at).getTime();
              if (age < 10000) {
                NotificationService.notify(n.title, {
                  body: n.message,
                  tag: n.id,
                });
              }
            });

          return unique.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
        });
      },
      (error) => {
        console.warn("Role notification listener failed:", error);
      },
    );

    // Listen to global preferences
    const unsubPrefs = onSnapshot(
      collection(db, "global_preferences"),
      (snapshot) => {
        setGlobalPreferences(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "global_preferences"),
    );

    return () => {
      unsubRooms();
      unsubMenu();
      unsubOrders();
      unsubLaundry();
      unsubBookings();
      unsubUsers();
      unsubConf();
      unsubLaundryServices();
      unsubConfServices();
      unsubConfBookings();
      unsubNotifs();
      unsubRoleNotifs();
      unsubPrefs();
    };
  }, [user]);

  // Migrate old third-party and legacy room image paths to local branded assets.
  useEffect(() => {
    if (authReady && user && rooms.length > 0) {
      const migrateImages = async () => {
        // Only run migration when the current role is allowed to normalize media paths.
        if (!canManagePosMenu(user.role) && !canManageRooms(user.role)) return;

        const roomsToUpdate = rooms.filter(
          (r) =>
            !r.imageUrl ||
            r.imageUrl?.startsWith("https://images.pexels.com") ||
            r.imageUrl?.includes("picsum.photos") ||
            r.imageUrl?.startsWith("/rooms/"),
        );

        if (roomsToUpdate.length > 0) {
          for (const room of roomsToUpdate) {
            const newUrl = getDefaultRoomImage(room);

            if (newUrl !== room.imageUrl) {
              try {
                await updateDoc(doc(db, "rooms", room.id), {
                  imageUrl: newUrl,
                });
              } catch (err) {
                console.error("Failed to migrate room image:", err);
              }
            }
          }
        }

        const menuItemsToUpdate = menu.filter((item) => {
          const canonicalUrl = getDefaultMenuImage(item);
          if (!item.imageUrl) return true;

          return (
            item.imageUrl.includes("picsum.photos") ||
            item.imageUrl.includes("pexels.com") ||
            item.imageUrl.endsWith(".svg") ||
            item.imageUrl !== canonicalUrl
          );
        });

        if (menuItemsToUpdate.length > 0) {
          for (const item of menuItemsToUpdate) {
            const newUrl = getDefaultMenuImage(item);

            if (newUrl !== item.imageUrl) {
              try {
                await updateDoc(doc(db, "menu_items", item.id), {
                  imageUrl: newUrl,
                });
              } catch (err) {
                console.error("Failed to migrate menu image:", err);
              }
            }
          }
        }
      };
      migrateImages();
    }
  }, [authReady, menu, rooms, user]);

  const createNotification = async (
    notif: Omit<HotelNotification, "id" | "read" | "created_at">,
  ) => {
    try {
      await createWorkflowNotification(notif, {
        showToast: (msg, type) => addToast(msg, type || "info"),
      });
    } catch (err) {
      console.error("Failed to create notification:", err);
      addToast("Failed to send notification", "error");
    }
  };

  const markHotelNotificationAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "notifications");
    }
  };

  const stats = useMemo(() => {
    return {
      activeGuests: bookings.filter((b) => b.status === "Active").length,
      availableRooms: rooms.filter((r) => r.status === "Available").length,
      pendingLaundry: laundry.filter((l) => l.status !== "Delivered").length,
      totalRevenue: [...bookings, ...orders, ...laundry].reduce(
        (sum, item) => sum + (item.total_price || 0),
        0,
      ),
    };
  }, [rooms, laundry, bookings, orders]);

  const handleLogout = () => signOut(auth);

  async function seedData() {
    try {
      // Check if rooms exist
      const roomSnap = await getDocs(collection(db, "rooms"));
      if (roomSnap.empty) {
        const initialRooms = [
          {
            number: "101",
            category: "Single",
            price: 450,
            status: "Available",
            imageUrl: LOCAL_ASSETS.rooms.single,
            description:
              "A cozy single room perfect for solo travelers, featuring a comfortable bed, a dedicated workspace, and a large window with garden views.",
            amenities: [
              "Free Wi-Fi",
              "Workspace",
              "En-suite Bathroom",
              "Coffee Station",
            ],
          },
          {
            number: "102",
            category: "Single",
            price: 450,
            status: "Available",
            imageUrl: LOCAL_ASSETS.rooms.single,
            description:
              "Modern single room with all essential amenities for a productive and comfortable stay.",
            amenities: [
              "Free Wi-Fi",
              "Workspace",
              "Smart TV",
              "Air Conditioning",
            ],
          },
          {
            number: "201",
            category: "Double",
            price: 750,
            status: "Occupied",
            imageUrl: LOCAL_ASSETS.rooms.double,
            description:
              "Spacious double room with a modern wooden headboard, large windows, and contemporary decor.",
            amenities: ["King Size Bed", "Mini Bar", "Safe", "City View"],
          },
          {
            number: "202",
            category: "Double",
            price: 750,
            status: "Available",
            imageUrl: LOCAL_ASSETS.rooms.doubleAlt,
            description:
              "Stylish double room featuring elegant blue accents, premium linens, and a relaxing atmosphere.",
            amenities: [
              "King Size Bed",
              "Lounge Chair",
              "Premium Toiletries",
              "Balcony",
            ],
          },
          {
            number: "301",
            category: "VIP",
            price: 1200,
            status: "Available",
            imageUrl: LOCAL_ASSETS.rooms.vip,
            description:
              "Our flagship luxury suite offering the ultimate in elegance and comfort. Features a king bed, separate living area, and panoramic views.",
            amenities: [
              "King Suite",
              "Private Balcony",
              "Jacuzzi",
              "Butler Service",
              "Complimentary Champagne",
            ],
          },
        ];
        for (const r of initialRooms) await addDoc(collection(db, "rooms"), r);

        const initialMenu = [
          {
            name: "T-Bone Steak",
            price: 180,
            category: "Main",
            type: "Restaurant",
            status: "Available",
            imageUrl: LOCAL_ASSETS.menu.steak,
          },
          {
            name: "Grilled Hake",
            price: 140,
            category: "Main",
            type: "Restaurant",
            status: "Available",
            imageUrl: LOCAL_ASSETS.menu.fish,
          },
          {
            name: "Greek Salad",
            price: 85,
            category: "Starter",
            type: "Restaurant",
            status: "Available",
            imageUrl: LOCAL_ASSETS.menu.salad,
          },
          {
            name: "Windhoek Lager",
            price: 35,
            category: "Drinks",
            type: "Bar",
            status: "Available",
            imageUrl: LOCAL_ASSETS.menu.beer,
            stock: 50,
            costPrice: 20,
            minStock: 10,
          },
          {
            name: "Red Wine Glass",
            price: 55,
            category: "Drinks",
            type: "Bar",
            status: "Available",
            imageUrl: LOCAL_ASSETS.menu.wine,
            stock: 24,
            costPrice: 30,
            minStock: 5,
          },
        ];
        for (const m of initialMenu)
          await addDoc(collection(db, "menu_items"), m);

        const initialLaundry = [
          { name: "Wash & Fold", price: 50 },
          { name: "Dry Cleaning", price: 120 },
          { name: "Ironing Only", price: 30 },
        ];
        for (const s of initialLaundry)
          await addDoc(collection(db, "laundry_services"), s);

        const initialConf = [
          {
            name: "Main Hall",
            capacity: 200,
            price_per_hour: 500,
            status: "Available",
          },
          {
            name: "Boardroom A",
            capacity: 15,
            price_per_hour: 150,
            status: "Available",
          },
        ];
        for (const c of initialConf)
          await addDoc(collection(db, "conference_rooms"), c);

        const initialConfServices = [
          { name: "Projector & Screen", price: 200 },
          { name: "Catering (per person)", price: 150 },
          { name: "PA System", price: 300 },
        ];
        for (const s of initialConfServices)
          await addDoc(collection(db, "conference_services"), s);

        const initialGlobalPrefs = [
          { name: "Mini Bar Selection", price: 300 },
          { name: "Base Laundry Service", price: 200 },
          { name: "Early Check-in", price: 150 },
          { name: "Late Check-out", price: 150 },
          { name: "Pool Side VIP", price: 250 },
          { name: "Sea View Upgrade", price: 500 },
          { name: "Priority Room Service", price: 100 },
        ];
        for (const s of initialGlobalPrefs)
          await addDoc(collection(db, "global_preferences"), s);

        // Create admin user doc
        if (auth.currentUser) {
          await setDoc(doc(db, "users", auth.currentUser.uid), {
            username: "admin",
            name: "Administrator",
            role: "Admin",
            email: auth.currentUser.email || "admin@pahukeni.com",
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "initialization");
    }
  }

  if (!authReady)
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-black/10 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs font-mono uppercase tracking-widest text-black/40">
            Initializing System...
          </p>
        </div>
      </div>
    );

  if (!user) return <AuthLoginPage />;

  if (!canAccessStaffArea(user.role)) {
    return (
      <CustomerPortal
        user={user}
        notifications={notifications}
        markHotelNotificationAsRead={markHotelNotificationAsRead}
        createNotification={createNotification}
        rooms={rooms}
        menu={menu}
        laundryServices={laundryServices}
        conferenceRooms={conferenceRooms}
        conferenceServices={conferenceServices}
        myOrders={orders}
        myLaundryOrders={laundry}
        myRoomBookings={bookings}
        myConferenceBookings={conferenceBookings}
        globalPreferences={globalPreferences}
      />
    );
  }

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["Admin", "Receptionist"],
    },
    {
      id: "rooms",
      label: "Rooms",
      icon: Bed,
      roles: ["Admin", "Receptionist"],
    },
    {
      id: "restaurant",
      label: "Restaurant",
      icon: Utensils,
      roles: ["Admin", "Receptionist", "Waiter"],
    },
    {
      id: "bar",
      label: "Bar POS",
      icon: Beer,
      roles: ["Admin", "Receptionist", "Waiter", "Barman"],
    },
    {
      id: "laundry",
      label: "Laundry",
      icon: WashingMachine,
      roles: ["Admin", "Receptionist", "Laundry"],
    },
    {
      id: "conference",
      label: "Conference",
      icon: Calendar,
      roles: ["Admin", "Receptionist"],
    },
    { id: "reports", label: "Reports", icon: FileText, roles: ["Admin"] },
    { id: "staff", label: "Staff", icon: Users, roles: ["Admin"] },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(user?.role || ""),
  );

  return (
    <>
      <AppErrorBoundary>
        <div className="min-h-screen bg-[#E4E3E0] flex flex-col lg:flex-row">
          {/* Mobile Header */}
          <div className="lg:hidden bg-[#141414] text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center p-1.5">
                <img
                  src={IMAGE_CATALOG.logo}
                  alt="Pahukeni Logo"
                  className="w-full h-full object-contain rounded"
                />
              </div>
              <div>
                <h1 className="text-lg font-serif italic leading-none">
                  Pahukeni
                </h1>
                <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest mt-1">
                  Pension Hotel
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Sidebar Overlay */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              />
            )}
          </AnimatePresence>

          {/* Sidebar */}
          <aside
            className={`
          fixed inset-y-0 left-0 w-72 bg-[#141414] text-white flex flex-col z-50 transition-transform duration-300 lg:relative lg:translate-x-0
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
          >
            <div className="p-8 hidden lg:block">
              <div className="flex items-center gap-4 mb-2">
                <img
                  src={IMAGE_CATALOG.logo}
                  alt="Pahukeni Logo"
                  className="w-10 h-10 rounded-xl"
                />
                <div>
                  <h1 className="text-2xl font-serif italic leading-none">
                    Pahukeni
                  </h1>
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mt-1">
                    Pension Hotel
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-8 lg:mt-0">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group
                  ${activeTab === item.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                >
                  <item.icon
                    size={18}
                    className={
                      activeTab === item.id
                        ? "text-white"
                        : "text-white/40 group-hover:text-white"
                    }
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 mt-auto">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Users size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium truncate">
                      {user?.name || "Administrator"}
                    </p>
                    <p className="text-[10px] font-mono text-white/30 uppercase">
                      {user?.role || "Admin"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full">
              <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12 gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-serif italic text-[#141414] capitalize">
                    {activeTab}
                  </h2>
                  <p className="text-[10px] md:text-xs font-mono text-black/40 uppercase tracking-widest mt-1">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setShowHotelNotifications(!showHotelNotifications)
                      }
                      className="p-2 hover:bg-black/5 rounded-xl transition-colors relative"
                    >
                      <Bell size={20} className="text-[#141414]" />
                      {notifications.filter((n) => !n.read).length > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#E4E3E0]"></span>
                      )}
                    </button>

                    <AnimatePresence>
                      {showHotelNotifications && (
                        <div className="absolute right-0 mt-2 w-80 z-50">
                          <NotificationCenterPanel
                            notifications={notifications}
                            onClose={() => setShowHotelNotifications(false)}
                            onMarkAsRead={markHotelNotificationAsRead}
                            onNavigate={(type, title) => {
                              if (type === "order") {
                                if (title?.toLowerCase().includes("bar"))
                                  setActiveTab("bar");
                                else setActiveTab("restaurant");
                              }
                              if (type === "laundry") setActiveTab("laundry");
                              if (type === "conference")
                                setActiveTab("conference");
                            }}
                          />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </header>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "dashboard" && (
                    <>
                      <DashboardPage stats={stats} bookings={bookings} />
                      {isAdmin(user?.role) && rooms.length === 0 && (
                        <div className="mt-8 p-6 bg-white rounded-2xl border border-dashed border-black/20 text-center">
                          <p className="text-sm text-black/40 mb-4">
                            Database appears empty. Initialize with sample data?
                          </p>
                          <button
                            onClick={seedData}
                            className="px-6 py-2 bg-black text-white rounded-xl text-xs font-mono uppercase tracking-widest"
                          >
                            Seed Database
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {activeTab === "rooms" && (
                    <RoomsModule
                      rooms={rooms}
                      bookings={bookings}
                      globalPreferences={globalPreferences}
                      isAdmin={isAdmin(user?.role)}
                      userRole={user?.role}
                    />
                  )}
                  {activeTab === "staff" && <StaffModule users={users} />}
                  {(activeTab === "restaurant" || activeTab === "bar") && (
                    <POSModule
                      type={activeTab === "restaurant" ? "Restaurant" : "Bar"}
                      menu={menu}
                      orders={orders}
                      isAdmin={isAdmin(user?.role)}
                      userRole={user?.role}
                      user={user!}
                      createNotification={createNotification}
                    />
                  )}
                  {activeTab === "laundry" && (
                    <LaundryModule
                      orders={laundry}
                      services={laundryServices}
                      isAdmin={isAdmin(user?.role)}
                      userRole={user?.role}
                      user={user!}
                      createNotification={createNotification}
                    />
                  )}
                  {activeTab === "conference" && (
                    <ConferenceModule
                      rooms={conferenceRooms}
                      services={conferenceServices}
                      bookings={conferenceBookings}
                      isAdmin={isAdmin(user?.role)}
                      userRole={user?.role}
                      user={user!}
                      createNotification={createNotification}
                    />
                  )}
                  {activeTab !== "dashboard" &&
                    activeTab !== "restaurant" &&
                    activeTab !== "bar" &&
                    activeTab !== "staff" &&
                    activeTab !== "laundry" &&
                    activeTab !== "conference" &&
                    activeTab !== "rooms" && (
                      <div className="bg-white p-12 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center text-center">
                        <AlertCircle size={48} className="text-black/10 mb-4" />
                        <h3 className="text-xl font-serif italic mb-2">
                          {activeTab} Module
                        </h3>
                        <p className="text-sm text-black/40 max-w-md">
                          This module is currently being populated with live
                          data. Please check back shortly or use the Dashboard
                          for an overview.
                        </p>
                      </div>
                    )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </AppErrorBoundary>
      {/* Toast HotelNotifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`
              pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-md min-w-[300px]
              ${
                toast.type === "success"
                  ? "bg-emerald-500/90 border-emerald-400 text-white"
                  : toast.type === "error"
                    ? "bg-red-500/90 border-red-400 text-white"
                    : "bg-black/80 border-white/10 text-white"
              }
            `}
            >
              <div className="flex items-center gap-3">
                {toast.type === "success" ? (
                  <CheckCircle2 size={18} />
                ) : toast.type === "error" ? (
                  <AlertCircle size={18} />
                ) : (
                  <Bell size={18} />
                )}
                <p className="text-xs font-medium">{toast.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
