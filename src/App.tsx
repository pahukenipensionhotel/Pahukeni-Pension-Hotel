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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { signOut } from "firebase/auth";
import { collection, getDocs, addDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { IMAGE_CATALOG } from "./shared/assets/imageCatalog";
import { Dashboard as DashboardPage } from "./features/dashboard/components/Dashboard";
import { LoginPage as AuthLoginPage } from "./features/auth/components/LoginPage";
import { NotificationCenter as NotificationCenterPanel } from "./features/notifications/components/NotificationCenter";
import { RoomsModule } from "./features/rooms/components/RoomsModule";
import { ErrorBoundary as AppErrorBoundary } from "./shared/components/ErrorBoundary";
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

export default function App() {
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

  const hotelData = useHotelData(addToast);
  const {
    user,
    authReady,
    rooms,
    menu,
    orders,
    laundry,
    bookings,
    users,
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
          },
          {
            number: "201",
            category: "Double",
            price: 750,
            status: "Available",
            imageUrl: IMAGE_CATALOG.rooms.double,
            description: "Spacious double room.",
            amenities: ["King Size Bed"],
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
      roles: ["Admin", "Receptionist", "Laundry man"],
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
                  alt="Logo"
                  className="w-full h-full object-contain rounded"
                  loading="lazy"
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
            className={`fixed inset-y-0 left-0 w-72 bg-[#141414] text-white flex flex-col z-50 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <div className="p-8 hidden lg:block">
              <div className="flex items-center gap-4 mb-2">
                <img
                  src={IMAGE_CATALOG.logo}
                  alt="Logo"
                  className="w-10 h-10 rounded-xl"
                  loading="lazy"
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
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${activeTab === item.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"}`}
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
                  {activeTab === "staff" && (
                    <StaffModule users={users} bookings={bookings} />
                  )}
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
                  {![
                    "dashboard",
                    "rooms",
                    "staff",
                    "restaurant",
                    "bar",
                    "laundry",
                    "conference",
                  ].includes(activeTab) && (
                    <div className="bg-white p-12 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center text-center">
                      <AlertCircle size={48} className="text-black/10 mb-4" />
                      <h3 className="text-xl font-serif italic mb-2">
                        {activeTab} Module
                      </h3>
                      <p className="text-sm text-black/40 max-w-md">
                        This module is currently being populated with live data.
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </AppErrorBoundary>
      <div className="fixed top-4 right-4 z-100 space-y-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-md min-w-75 ${toast.type === "success" ? "bg-emerald-500/90 border-emerald-400 text-white" : toast.type === "error" ? "bg-red-500/90 border-red-400 text-white" : "bg-black/80 border-white/10 text-white"}`}
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
