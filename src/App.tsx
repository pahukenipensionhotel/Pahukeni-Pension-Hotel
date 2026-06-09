import React, { useState, useEffect } from "react";
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
  X,
  Menu,
  Bell,
  AlertCircle,
  CheckCircle2,
  ScrollText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  setPersistence,
  browserSessionPersistence,
  signOut,
} from "firebase/auth";
import { collection, getDocs, addDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { IMAGE_CATALOG } from "./shared/assets/imageCatalog";
import { Dashboard as DashboardPage } from "./features/dashboard/components/Dashboard";
import { LoginPage as AuthLoginPage } from "./features/auth/components/LoginPage";
import { NotificationCenter as NotificationCenterPanel } from "./features/notifications/components/NotificationCenter";
import { RoomsModule } from "./features/rooms/components/RoomsModule";
import { ErrorBoundary as AppErrorBoundary } from "./shared/components/ErrorBoundary";
import { NetworkStatusBanner } from "./shared/components/NetworkStatusBanner";
import { useHotelData } from "./hooks/useHotelData";
import { isAdmin, canAccessStaffArea } from "./shared/security/authorization";
import {
  handleFirestoreError,
  OperationType,
} from "./shared/validation/inputs";
import {
  getHashTab as getRouteHashTab,
  STAFF_TABS as STAFF_ROUTE_TABS,
  syncHashTab as syncRouteHashTab,
} from "./app/router/routeState";

// Modular feature components
import { POSModule } from "./features/orders/components/POSModule";
import { LaundryModule } from "./features/laundry/components/LaundryModule";
import { ConferenceModule } from "./features/conference/components/ConferenceModule";
import { StaffModule } from "./features/staff/components/StaffModule";
import { CustomerPortal } from "./features/dashboard/components/CustomerPortal";
import { ReportsModule } from "./features/reports/components/ReportsModule";
import { SystemLogs } from "./features/reports/components/SystemLogs";
import { NotificationSystem } from "./shared/components/NotificationSystem";
import { useNotificationStore } from "./shared/hooks/useNotifications";
import usePushNotifications from "./hooks_usePushNotifications";

export default function App() {
  usePushNotifications();
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Force session persistence
  useEffect(() => {
    setPersistence(auth, browserSessionPersistence).catch((err) =>
      console.error("Failed to set persistence", err),
    );
  }, []);

  // --- Session Inactivity Timer (15 mins) ---
  useEffect(() => {
    let inactivityTimeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(
        () => {
          if (auth.currentUser) {
            signOut(auth);
            addNotification({
              type: "warning",
              layout: "modal",
              title: "Session Expired",
              message:
                "Your session has expired due to inactivity. Please log in again.",
            });
          }
        },
        15 * 60 * 1000,
      );
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(inactivityTimeout);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [addNotification]);

  const addToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    addNotification({
      type: type === "info" ? "info" : type,
      layout: "toast",
      message,
    });
  };

  const hotelData = useHotelData(addToast);
  const {
    user,
    authReady,
    rooms,
    menu,
    orders,
    laundry,
    bookings,
    conferenceRooms,
    laundryServices,
    conferenceServices,
    conferenceBookings,
    globalPreferences,
    notifications,
    stats,
    createNotification,
    markHotelNotificationAsRead,
  } = hotelData;

  const [activeTab, setActiveTab] = useState<string>(() =>
    getRouteHashTab("staff", STAFF_ROUTE_TABS, "dashboard"),
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHotelNotifications, setShowHotelNotifications] = useState(false);

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

  const handleLogout = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    signOut(auth);
  };

  async function seedData() {
    try {
      const roomSnap = await getDocs(collection(db, "rooms"));
      if (roomSnap.empty) {
        const initialRooms = [
          {
            number: "101",
            category: "Single",
            price: 450,
            status: "Available",
            imageUrl: IMAGE_CATALOG.rooms.single,
            description: "Cozy single room.",
            amenities: ["Free Wi-Fi"],
            breakfastPrice: 100,
          },
          {
            number: "201",
            category: "Double",
            price: 750,
            status: "Available",
            imageUrl: IMAGE_CATALOG.rooms.double,
            description: "Spacious double room.",
            amenities: ["King Size Bed"],
            breakfastPrice: 150,
          },
        ];
        for (const r of initialRooms) await addDoc(collection(db, "rooms"), r);
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
      <>
        <NetworkStatusBanner />
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
      </>
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
      roles: ["Admin", "Receptionist", "Laundry man"],
    },
    {
      id: "conference",
      label: "Conference",
      icon: Calendar,
      roles: ["Admin", "Receptionist"],
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
      roles: ["Admin", "Receptionist", "Waiter", "Barman", "Laundry man"],
    },
    {
      id: "system_logs",
      label: "System Logs",
      icon: ScrollText,
      roles: ["Admin", "System Developer"],
      isDeveloperOnly: true,
    },
    { id: "staff", label: "Staff", icon: Users, roles: ["Admin"] },
  ];

  const filteredMenuItems = menuItems.filter((item) => {
    const hasRole = item.roles.includes(user?.role || "");
    if ((item as any).isDeveloperOnly) {
      return hasRole && user?.email === "btutu427@gmail.com";
    }
    return hasRole;
  });

  return (
    <>
      <NetworkStatusBanner />
      <AppErrorBoundary>
        <div className="h-screen bg-[#E4E3E0] flex flex-col lg:flex-row overflow-hidden">
          {/* Mobile Header */}
          <div className="lg:hidden bg-[#141414] text-white p-6 flex items-center justify-between sticky top-0 z-50 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center p-2">
                <img
                  src={IMAGE_CATALOG.logo}
                  alt="Logo"
                  className="w-full h-full object-contain rounded"
                  loading="lazy"
                />
              </div>
              <div>
                <h1 className="text-xl font-serif italic leading-none">
                  Pahukeni
                </h1>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-1">
                  Pension Hotel
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-3 hover:bg-white/10 rounded-xl transition-colors"
              >
                {isSidebarOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>

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

          <aside
            className={`fixed inset-y-0 left-0 w-80 bg-[#141414] text-white flex flex-col z-50 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} shadow-2xl lg:shadow-none`}
          >
            <div className="p-10 hidden lg:block">
              <div className="flex items-center gap-5 mb-2">
                <img
                  src={IMAGE_CATALOG.logo}
                  alt="Logo"
                  className="w-12 h-12 rounded-2xl"
                  loading="lazy"
                />
                <div>
                  <h1 className="text-3xl font-serif italic leading-none">
                    Pahukeni
                  </h1>
                  <p className="text-[12px] font-mono text-white/40 uppercase tracking-[0.25em] mt-1">
                    Pension Hotel
                  </p>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-6 space-y-3 mt-8 lg:mt-0 overflow-y-auto custom-scrollbar">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-5 px-5 py-4 rounded-2xl transition-all group ${activeTab === item.id ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                >
                  <item.icon
                    size={20}
                    className={
                      activeTab === item.id
                        ? "text-white"
                        : "text-white/40 group-hover:text-white"
                    }
                  />
                  <span className="text-base font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-6 mt-auto">
              <div className="bg-white/5 p-5 rounded-4xl border border-white/5 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                    <Users size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate">
                      {user?.name || "Administrator"}
                    </p>
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                      {user?.role || "Admin"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <a
                  href="https://www.facebook.com/share/1BWf2e46F7/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white/5 p-5 rounded-2xl border border-white/5 text-white/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <img
                    src={IMAGE_CATALOG.facebook}
                    className="w-4 h-4 object-contain"
                    alt="Facebook"
                  />
                  <span className="text-[11px] font-mono uppercase tracking-widest">
                    Facebook Page
                  </span>
                </a>
                <a
                  href="https://wa.me/264818202171"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white/5 p-5 rounded-2xl border border-white/5 text-white/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <img
                    src={IMAGE_CATALOG.whatsapp}
                    className="w-5 h-5 object-contain"
                    alt="WhatsApp"
                  />
                  <span className="text-[11px] font-mono uppercase tracking-widest">
                    WhatsApp Chat
                  </span>
                </a>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-6 py-4 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all active:scale-95"
              >
                <LogOut size={20} />
                <span className="text-base font-semibold">Logout</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 p-6 md:p-12 lg:p-16 overflow-y-auto custom-scrollbar relative bg-[#E4E3E0]">
            <div className="max-w-8xl mx-auto w-full">
              <header className="flex flex-row items-center justify-between mb-12 md:mb-16 gap-6 flex-wrap md:flex-nowrap">
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif italic text-[#141414] capitalize tracking-tight truncate">
                    {activeTab}
                  </h2>
                  <p className="text-[10px] md:text-xs font-mono text-black/30 uppercase tracking-[0.2em] mt-3 ml-1">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  {/* Global Notification Bell */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setShowHotelNotifications(!showHotelNotifications)
                      }
                      className="p-3 hover:bg-black/5 rounded-xl transition-colors relative active:scale-95"
                    >
                      <Bell size={22} className="text-[#141414]" />
                      {notifications.filter((n) => !n.read).length > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#E4E3E0]"></span>
                      )}
                    </button>
                    <AnimatePresence>
                      {showHotelNotifications && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-4 w-96 z-[100] p-2 origin-top-right"
                        >
                          <div className="glass-effect rounded-3xl shadow-2xl border border-black/5 overflow-hidden">
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
                        </motion.div>
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
                  {activeTab === "staff" && <StaffModule bookings={bookings} />}
                  {(activeTab === "restaurant" || activeTab === "bar") && (
                    <POSModule
                      type={activeTab === "restaurant" ? "Restaurant" : "Bar"}
                      menu={menu}
                      orders={orders}
                      isAdmin={isAdmin(user?.role)}
                      userRole={user?.role}
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
                  {activeTab === "reports" && (
                    <ReportsModule rooms={rooms} menu={menu} user={user} />
                  )}
                  {activeTab === "system_logs" && <SystemLogs />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </AppErrorBoundary>
      <NotificationSystem />
    </>
  );
}
