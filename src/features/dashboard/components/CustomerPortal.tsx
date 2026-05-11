import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bed,
  Utensils,
  WashingMachine,
  Users,
  LogOut,
  Menu,
  ChevronRight,
  X,
  Bell,
  Home as HomeIcon,
  ClipboardList,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import {
  Room,
  MenuItem,
  Order,
  LaundryOrder,
  User,
  ConferenceRoom,
  ConferenceService,
  LaundryService,
  RoomBooking,
  ConferenceBooking,
  Notification as HotelNotification,
  GlobalPreference,
} from "../../../shared/types/hotel";
import {
  IMAGE_CATALOG,
  getDefaultRoomImage,
} from "../../../shared/assets/imageCatalog";
import {
  getHashTab as getRouteHashTab,
  PORTAL_TABS as PORTAL_ROUTE_TABS,
  syncHashTab as syncRouteHashTab,
} from "../../../app/router/routeState";
import { NotificationService } from "../../../services/notificationService";
import { NotificationCenter as NotificationCenterPanel } from "../../notifications/components/NotificationCenter";
import { RoomDetailsModal } from "../../rooms/components/RoomDetailsModal";

import { logger } from "../../../shared/utils/logger";

const LOCAL_ASSETS = IMAGE_CATALOG;

export const CustomerPortal = ({
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
  createNotification: (
    notif: Omit<HotelNotification, "id" | "read" | "created_at">,
  ) => Promise<void>;
  rooms: Room[];
  menu: MenuItem[];
  laundryServices: LaundryService[];
  conferenceRooms: ConferenceRoom[];
  conferenceServices: ConferenceService[];
  myOrders: Order[];
  myLaundryOrders: LaundryOrder[];
  myRoomBookings: RoomBooking[];
  myConferenceBookings: ConferenceBooking[];
  globalPreferences?: GlobalPreference[];
}) => {
  const HERO_SLIDE_INTERVAL_MS = 4000;
  const HERO_TRANSITION_SECONDS = 0.55;
  const [activeTab, setActiveTab] = useState<string>(() =>
    getRouteHashTab("portal", PORTAL_ROUTE_TABS, "home"),
  );
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHotelNotifications, setShowHotelNotifications] = useState(false);
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
    const id = Math.random().toString(36).substring(2, 9);
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
        items: [{ ...item, qty: 1 }],
        total_price: item.price,
        status: "Pending",
        type: item.type,
        created_at: new Date().toISOString(),
      });

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
    options: {
      includeBreakfast: boolean;
      selectedAddons: string[];
      checkInDate: string;
      checkOutDate: string;
    },
  ) => {
    try {
      const addonFromRoom = (room.additionalServices || [])
        .filter((s) => options.selectedAddons.includes(s.name))
        .reduce((sum, s) => sum + s.price, 0);
      const addonFromGlobal = (globalPreferences || [])
        .filter((s) => options.selectedAddons.includes(s.name))
        .reduce((sum, s) => sum + s.price, 0);

      const start = new Date(options.checkInDate);
      const end = new Date(options.checkOutDate);
      const nights = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      );

      const finalPrice =
        room.price * nights +
        (options.includeBreakfast ? (room.breakfastPrice || 0) * nights : 0) +
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
        check_in: new Date(options.checkInDate).toISOString(),
        check_out: new Date(options.checkOutDate).toISOString(),
        created_at: new Date().toISOString(),
      });

      await logger.info(
        "BOOKING",
        "NEW_BOOKING_REQUEST",
        `${user.name} requested booking for Room ${room.number}`,
        user.id,
        user.name,
        {
          roomId: room.id,
          checkIn: options.checkInDate,
          checkOut: options.checkOutDate,
          price: finalPrice,
        },
      );

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
        items: [{ ...service, qty: 1 }],
        total_price: service.price,
        status: "Received",
        created_at: new Date().toISOString(),
      });

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
    const allOrders = [
      ...myOrders,
      ...myLaundryOrders,
      ...myRoomBookings,
      ...myConferenceBookings,
    ];
    allOrders.forEach((order) => {
      const prevStatus = lastStatuses.current[order.id];
      if (prevStatus && prevStatus !== order.status) {
        const type =
          "type" in order
            ? `${order.type} Order`
            : "room_number" in order
              ? "Room Booking"
              : "room_id" in order
                ? "Conference Booking"
                : "Laundry Service";
        const message = `${type} status updated to: ${order.status}`;
        const id = Math.random().toString(36).substring(2, 9);

        setToasts((prev) => [...prev, { id, message, type: "success" }]);

        NotificationService.notify("Order Update", {
          body: message,
          tag: order.id,
        });

        setTimeout(() => {
          setToasts((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
      }
      lastStatuses.current[order.id] = order.status;
    });
    isInitialLoad.current = false;
  }, [myOrders, myLaundryOrders, myRoomBookings, myConferenceBookings]);

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

  const isRoomCurrentlyBooked = (roomId: string) => {
    const now = new Date();
    return myRoomBookings.some((b) => {
      if (b.room_id !== roomId || b.status === "Cancelled") return false;
      const start = new Date(b.check_in);
      const end = new Date(b.check_out);
      return now >= start && now < end;
    });
  };

  const getRoomDisplayStatus = (room: Room) => {
    if (isRoomCurrentlyBooked(room.id)) return "Currently Booked";
    return room.status;
  };

  return (
    <div className="h-screen bg-[#F5F5F4] flex flex-col overflow-hidden">
      {/* Toast Notification Container (Reliably Contained) */}
      <div className="fixed top-6 right-6 z-100 space-y-3 pointer-events-none max-w-sm">
        <AnimatePresence>
          {toasts.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-effect p-5 rounded-3xl shadow-2xl flex items-center gap-4 pointer-events-auto border-black/5"
            >
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0 shadow-lg">
                <Bell size={18} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-[#141414] leading-snug">
                {n.message}
              </p>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((notif) => notif.id !== n.id))
                }
                className="ml-auto p-1.5 hover:bg-black/5 rounded-lg transition-colors"
              >
                <X size={16} className="text-black/20" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <header className="bg-white/80 backdrop-blur-md border-b border-black/5 p-6 sticky top-0 z-20">
        <div className="max-w-8xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center p-2 shadow-lg">
                <img
                  src={IMAGE_CATALOG.logo}
                  alt="Pahukeni"
                  className="w-full h-full object-contain invert"
                />
              </div>
              <h1 className="text-2xl font-serif italic tracking-tight">
                Pahukeni Portal
              </h1>
            </div>
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 tracking-wider">
                Live Concierge
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() =>
                  setShowHotelNotifications(!showHotelNotifications)
                }
                className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors relative active:scale-95"
              >
                <Bell size={22} className="text-black/60" />
                {globalHotelNotifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
                )}
              </button>

              <AnimatePresence>
                {showHotelNotifications && (
                  <div className="absolute right-0 mt-4 w-96 z-50">
                    <NotificationCenterPanel
                      notifications={globalHotelNotifications}
                      onClose={() => setShowHotelNotifications(false)}
                      onMarkAsRead={markHotelNotificationAsRead}
                      onNavigate={(type) => {
                        if (type === "order") setActiveTab("orders");
                        if (type === "laundry") setActiveTab("laundry");
                        if (type === "conference") setActiveTab("conference");
                      }}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-[#141414]">
                {user.name}
              </span>
              <span className="text-[9px] font-mono text-black/30 uppercase tracking-widest font-black">
                Valued Guest
              </span>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="p-3 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 rounded-xl transition-all active:scale-90 shadow-sm"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-8xl mx-auto w-full p-6 md:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-4 gap-12 relative overflow-hidden">
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.aside
              initial={{ x: -350 }}
              animate={{ x: 0 }}
              exit={{ x: -350 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-white z-40 p-10 shadow-2xl lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-3xl font-serif italic tracking-tight text-[#141414]">
                  Concierge
                </h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-3 bg-gray-50 rounded-full text-black/40"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {[
                  { id: "home", label: "Overview", icon: HomeIcon },
                  { id: "rooms", label: "Accommodation", icon: Bed },
                  { id: "dining", label: "Dining", icon: Utensils },
                  { id: "laundry", label: "Laundry", icon: WashingMachine },
                  { id: "conference", label: "Events", icon: Users },
                  { id: "orders", label: "My History", icon: ClipboardList },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-5 p-5 rounded-3xl transition-all ${
                      activeTab === item.id
                        ? "bg-black text-white shadow-2xl shadow-black/20"
                        : "bg-white text-black/60 hover:bg-gray-50 border border-black/5"
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="text-base font-semibold">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <aside className="hidden lg:block lg:col-span-1 space-y-4">
          <div className="space-y-3">
            {[
              { id: "home", label: "Overview", icon: HomeIcon },
              { id: "rooms", label: "Accommodation", icon: Bed },
              { id: "dining", label: "Dining", icon: Utensils },
              { id: "laundry", label: "Laundry", icon: WashingMachine },
              { id: "conference", label: "Events", icon: Users },
              { id: "orders", label: "My History", icon: ClipboardList },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-5 p-5 rounded-[1.5rem] transition-all ${
                  activeTab === item.id
                    ? "bg-black text-white shadow-2xl shadow-black/20 scale-[1.02]"
                    : "bg-white text-black/50 hover:text-black hover:bg-white border border-black/5 shadow-sm hover:shadow-md"
                }`}
              >
                <item.icon size={20} />
                <span className="text-base font-semibold">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="pt-8 space-y-3">
            <p className="text-[10px] font-mono font-black uppercase text-black/20 tracking-[0.3em] ml-5 mb-4">
              Connect With Us
            </p>
            <a
              href="https://www.facebook.com/share/1BWf2e46F7/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-blue-50/50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm hover:shadow-lg active:scale-95"
            >
              <img
                src={LOCAL_ASSETS.facebook}
                className="w-5 h-5 object-contain transition-all group-hover:brightness-0 group-hover:invert"
                alt="Facebook"
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                Facebook
              </span>
            </a>
            <a
              href="https://wa.me/264818202171"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-emerald-50/50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm hover:shadow-lg active:scale-95"
            >
              <img
                src={LOCAL_ASSETS.whatsapp}
                className="w-5 h-5 object-contain"
                alt="WhatsApp"
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                WhatsApp
              </span>
            </a>
          </div>
        </aside>

        <main className="lg:col-span-3 h-full overflow-y-auto custom-scrollbar pr-4">
          <AnimatePresence initial={false} mode="wait">
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-8"
              >
                <div className="relative h-100 md:h-125 rounded-3xl overflow-hidden shadow-2xl group">
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
                      draggable={false}
                    />
                  ))}

                  {!heroImagesReady && (
                    <div className="absolute inset-0 bg-black/40 animate-pulse" />
                  )}

                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-12">
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
                        <div className="aspect-4/5 rounded-2xl overflow-hidden mb-6 relative shadow-md bg-black">
                          <img
                            loading="lazy"
                            src={getRoomImage(room)}
                            alt={room.category}
                            className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-60 transition-all duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-linear-to-t from-black/80 via-black/20 to-transparent">
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
                              {getRoomDisplayStatus(room) ===
                              "Currently Booked" ? (
                                <span className="text-orange-600 font-bold">
                                  Currently Booked
                                </span>
                              ) : (
                                `${room.category} Suite`
                              )}
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
                    loading="lazy"
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

                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-sm group hover:shadow-xl transition-all"
                    >
                      <div className="aspect-[16/10] overflow-hidden relative">
                        <img
                          loading="lazy"
                          src={getRoomImage(room)}
                          alt={`Room ${room.number}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 right-3 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider">
                          {room.category}
                        </div>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="px-1.5 py-0.5 bg-black/5 rounded text-[7px] font-mono text-black/40 font-bold uppercase tracking-widest">
                                {room.number.match(/^[A-Z]+/)?.[0] || "RM"}
                              </span>
                              <h3 className="text-xl font-serif font-black tracking-tight text-[#141414] leading-none">
                                {room.number.replace(/^[A-Z]+/, "")}
                              </h3>
                            </div>
                            <p
                              className={`text-[8px] font-mono font-bold uppercase tracking-widest ${
                                getRoomDisplayStatus(room) === "Available"
                                  ? "text-emerald-600"
                                  : "text-orange-600"
                              }`}
                            >
                              {getRoomDisplayStatus(room)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-serif font-black text-[#141414] leading-none">
                              N$ {room.price}
                            </p>
                            <p className="text-[7px] text-black/30 font-mono font-bold uppercase tracking-tighter">
                              Per Night
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedRoom(room)}
                            className="flex-1 py-2.5 bg-white border border-black/10 text-[#141414] rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-black/5 transition-all btn-interactive"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => setSelectedRoom(room)}
                            className="flex-1 py-2.5 bg-black text-white rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-black/90 transition-all shadow-lg active:scale-95 btn-interactive"
                          >
                            Book Now
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
                      className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-serif italic">{item.name}</h3>
                          <p className="text-[10px] font-mono text-black/40 uppercase mt-1">
                            {item.category} • {item.type}
                          </p>
                        </div>
                        <div className="text-right">
                          {item.type !== "Bar" && (
                            <p className="text-sm font-serif italic">
                              N$ {item.price}
                            </p>
                          )}
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
                    {[
                      ...myOrders,
                      ...myLaundryOrders,
                      ...myRoomBookings,
                      ...myConferenceBookings,
                    ]
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
                                  : "room_number" in order
                                    ? `Room ${order.room_number} Booking`
                                    : "room_id" in order
                                      ? "Conference Booking"
                                      : "Laundry Service"}
                              </p>
                              <p className="text-[10px] font-mono text-black/40 uppercase">
                                {new Date(order.created_at).toLocaleString()}
                              </p>
                              {"estimated_arrival" in order &&
                                order.estimated_arrival && (
                                  <p className="text-[10px] font-mono text-blue-600 uppercase mt-1 font-bold">
                                    Est.{" "}
                                    {"type" in order ? "Arrival" : "Delivery"}:{" "}
                                    {order.estimated_arrival}
                                  </p>
                                )}
                            </div>
                          </div>
                          <div className="text-right">
                            {(!("type" in order) || order.type !== "Bar") && (
                              <p className="text-sm font-serif italic">
                                N$ {order.total_price}
                              </p>
                            )}
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
                    {myOrders.length === 0 &&
                      myLaundryOrders.length === 0 &&
                      myRoomBookings.length === 0 &&
                      myConferenceBookings.length === 0 && (
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
              roomBookings={myRoomBookings}
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
