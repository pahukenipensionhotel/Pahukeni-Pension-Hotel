import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  ClipboardList,
  Search,
  Receipt,
} from "lucide-react";
import {
  format,
  parseISO,
  differenceInDays,
  isSameDay,
  startOfToday,
  addDays,
} from "date-fns";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import {
  Room,
  RoomBooking,
  User,
  GlobalPreference,
  Folio,
} from "../../../shared/types/hotel";
import { canManageRooms } from "../../../shared/security/authorization";
import {
  handleFirestoreError,
  OperationType,
} from "../../../shared/validation/inputs";
import { IMAGE_CATALOG } from "../../../shared/assets/imageCatalog";
import { logger } from "../../../shared/utils/logger";

import { BookingModal } from "./BookingModal";
import { BookingCalendar } from "./BookingCalendar";
import { FolioModal } from "./FolioModal";

// Helper for local assets in this module (using the same structure as App.tsx used to have)
const LOCAL_ASSETS = {
  rooms: {
    single: IMAGE_CATALOG.rooms.single,
    singleGallery: IMAGE_CATALOG.rooms.singleGallery,
    double: IMAGE_CATALOG.rooms.double,
    doubleGallery: IMAGE_CATALOG.rooms.doubleGallery,
    doubleAlt: IMAGE_CATALOG.rooms.doubleAlt,
    vip: IMAGE_CATALOG.rooms.vip,
    exterior: IMAGE_CATALOG.rooms.exterior,
  },
};

const conferenceShowcase = IMAGE_CATALOG.showcase.conference[0];

const parseNumberInput = (val: string) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

export const RoomsModule = ({
  rooms,
  bookings,
  globalPreferences,
  folios,
  isAdmin,
  userRole,
}: {
  rooms: Room[];
  bookings: RoomBooking[];
  globalPreferences: GlobalPreference[];
  folios: Folio[];
  isAdmin: boolean;
  userRole?: string;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [selectedFolioBooking, setSelectedFolioBooking] =
    useState<RoomBooking | null>(null);
  const [portfolioServices, setPortfolioServices] =
    useState<GlobalPreference[]>(globalPreferences);
  const [newRoom, setNewRoom] = useState<Omit<Room, "id"> & { prefix: string }>(
    {
      number: "",
      category: "Single",
      price: 0,
      status: "Available",
      imageUrl: LOCAL_ASSETS.rooms.single,
      description: "",
      amenities: [],
      breakfastIncluded: true,
      breakfastPrice: 100,
      additionalServices: [],
      prefix: "SR",
    },
  );

  const [selectedBookingRoom, setSelectedBookingRoom] = useState<Room | null>(
    null,
  );
  const [bookingSearch, setBookingSearch] = useState("");

  const searchedRooms = useMemo(() => {
    if (!bookingSearch.trim()) return rooms;
    const term = bookingSearch.toLowerCase();
    return rooms.filter(
      (r) =>
        r.number.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term),
    );
  }, [rooms, bookingSearch]);

  const canManage = canManageRooms(userRole as User["role"] | undefined);

  useEffect(() => {
    setPortfolioServices(globalPreferences);
  }, [globalPreferences]);

  const handleAddRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const { prefix, number, ...roomData } = newRoom;
    const finalNumber = (prefix + number).trim();
    if (!number.trim()) {
      alert("Please provide a room number.");
      return;
    }

    try {
      if (editingRoomId) {
        await updateDoc(doc(db, "rooms", editingRoomId), {
          ...roomData,
          number: finalNumber,
          updated_at: new Date().toISOString(),
        });
        setEditingRoomId(null);
      } else {
        await addDoc(collection(db, "rooms"), {
          ...roomData,
          number: finalNumber,
          created_at: new Date().toISOString(),
        });
      }
      setIsAdding(false);
      setNewRoom({
        number: "",
        category: "Single",
        price: 0,
        status: "Available",
        imageUrl: LOCAL_ASSETS.rooms.single,
        description: "",
        amenities: [],
        breakfastIncluded: true,
        breakfastPrice: 150,
        additionalServices: [],
        prefix: "SR",
      });
    } catch (err) {
      console.error("Firestore Error (Rooms):", err);
      handleFirestoreError(err, OperationType.WRITE, "rooms");
    }
  };

  const startEdit = (room: Room) => {
    setEditingRoomId(room.id);
    setNewRoom({
      category: room.category,
      price: room.price,
      status: room.status,
      breakfastIncluded: room.breakfastIncluded ?? true,
      breakfastPrice: room.breakfastPrice ?? 100,
      additionalServices: room.additionalServices ?? [],
      description: room.description ?? "",
      amenities: room.amenities ?? [],
      imageUrl: room.imageUrl ?? LOCAL_ASSETS.rooms.single,
      prefix: room.number.match(/^[A-Z]+/)?.[0] || "SR",
      number: room.number.replace(/^[A-Z]+/, ""),
    });
    setIsAdding(true);
  };

  const deleteRoom = async (roomId: string) => {
    try {
      await deleteDoc(doc(db, "rooms", roomId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "rooms");
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<
    "rooms" | "bookings" | "services" | "calendar"
  >("rooms");

  const [newPref, setNewPref] = useState({ name: "", price: "" });
  const [isAddingPref, setIsAddingPref] = useState(false);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [portfolioFormError, setPortfolioFormError] = useState<string | null>(
    null,
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % 5); // Cycle through first 5 gallery images
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPortfolioService = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingPref) return;

    const serviceName = newPref.name.trim();
    const normalizedPrice = newPref.price.trim();
    const validatedPrice = Number(normalizedPrice);
    setPortfolioFormError(null);
    if (!serviceName) {
      setPortfolioFormError("Please provide a service name.");
      return;
    }
    if (
      !normalizedPrice ||
      !Number.isFinite(validatedPrice) ||
      validatedPrice < 0
    ) {
      setPortfolioFormError(
        "Please provide a valid non-negative service price.",
      );
      return;
    }

    try {
      setIsSavingPref(true);
      await addDoc(collection(db, "global_preferences"), {
        name: serviceName,
        price: validatedPrice,
        created_at: new Date().toISOString(),
      });
      setNewPref({ name: "", price: "" });
      setIsAddingPref(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "global_preferences");
    } finally {
      setIsSavingPref(false);
    }
  };

  const deletePortfolioService = async (id: string) => {
    try {
      await deleteDoc(doc(db, "global_preferences", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "global_preferences");
    }
  };

  const currentBookings = useMemo(() => {
    const now = new Date();
    return bookings
      .filter((b) => {
        if (b.status === "Cancelled" || b.status === "Checked Out")
          return false;
        const start = new Date(b.check_in);
        const end = new Date(b.check_out);
        return now >= start && now < end;
      })
      .sort(
        (a, b) =>
          new Date(a.check_in).getTime() - new Date(b.check_in).getTime(),
      );
  }, [bookings]);

  const searchedBookings = useMemo(() => {
    if (!bookingSearch.trim()) return bookings;
    const term = bookingSearch.toLowerCase();
    return bookings.filter(
      (b) =>
        b.guest_name.toLowerCase().includes(term) ||
        b.room_number.toLowerCase().includes(term) ||
        b.guest_email?.toLowerCase().includes(term),
    );
  }, [bookings, bookingSearch]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-8">
          <h2 className="text-xl md:text-2xl font-serif italic">
            Room Registry
          </h2>
          <div className="flex bg-white/50 p-1 rounded-xl border border-black/5 w-fit overflow-x-auto">
            <button
              onClick={() => setActiveSubTab("rooms")}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeSubTab === "rooms" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Accommodation
            </button>
            <button
              onClick={() => setActiveSubTab("bookings")}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeSubTab === "bookings" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveSubTab("calendar")}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeSubTab === "calendar" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setActiveSubTab("services")}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                ${activeSubTab === "services" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Portfolio
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && activeSubTab === "rooms" && (
            <button
              onClick={() => {
                setEditingRoomId(null);
                setNewRoom({
                  number: "",
                  category: "Single",
                  price: 0,
                  status: "Available",
                  imageUrl: LOCAL_ASSETS.rooms.single,
                  description: "",
                  amenities: [],
                  breakfastIncluded: true,
                  breakfastPrice: 150,
                  additionalServices: [],
                  prefix: "SR",
                });
                setIsAdding(true);
              }}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-xs sm:text-sm font-medium whitespace-nowrap flex items-center gap-2"
            >
              <Plus size={18} /> Add Individual Room
            </button>
          )}
          {canManage && activeSubTab === "services" && (
            <button
              onClick={() => setIsAddingPref(true)}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/10 hover:bg-blue-700 transition-all text-xs sm:text-sm font-medium whitespace-nowrap flex items-center gap-2"
            >
              <Plus size={18} /> New Portfolio Service
            </button>
          )}
        </div>
      </div>

      {activeSubTab === "rooms" ? (
        <div className="space-y-6 flex-1 min-h-0 flex flex-col">
          <div className="relative mb-4">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20"
              size={18}
            />
            <input
              type="text"
              placeholder="Search registry by unit or category..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-black/5 rounded-2xl outline-none focus:border-black/10 transition-all shadow-sm text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 content-start pb-8">
            {searchedRooms.map((room) => (
              <motion.div
                key={room.id}
                whileHover={{ y: -6, scale: 1.01 }}
                className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:shadow-xl transition-all relative group overflow-hidden flex flex-col gap-3"
              >
                <div className="aspect-16/10 rounded-xl overflow-hidden bg-gray-100 relative shadow-inner shrink-0">
                  ...
                  <div className="absolute top-2 right-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[7px] font-mono font-bold uppercase tracking-wider border backdrop-blur-md shadow-sm
                      ${
                        room.status === "Available"
                          ? "bg-emerald-500/90 text-white border-emerald-400"
                          : room.status === "Occupied"
                            ? "bg-red-500/90 text-white border-red-400"
                            : "bg-orange-500/90 text-white border-orange-400"
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between gap-3 px-0.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[8px] font-mono text-black/30 uppercase tracking-widest font-black">
                        Unit {room.number}
                      </p>
                      <span className="w-1 h-1 rounded-full bg-black/5"></span>
                      <p className="text-[8px] font-mono text-black/20 uppercase tracking-tighter font-bold">
                        {room.category}
                      </p>
                    </div>
                    <h3 className="text-lg font-serif italic text-[#141414] tracking-tight leading-tight">
                      {room.category} Suite
                    </h3>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-end border-t border-black/5 pt-2.5">
                      <div>
                        <p className="text-[7px] font-mono text-black/20 uppercase tracking-widest font-black">
                          Nightly
                        </p>
                        <p className="text-lg font-serif italic font-black text-black leading-none">
                          N$ {room.price}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        {canManage && (
                          <button
                            onClick={() => startEdit(room)}
                            className="p-2 bg-gray-50 border border-black/5 rounded-lg hover:bg-black hover:text-white transition-all text-black/30 btn-interactive"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => deleteRoom(room.id)}
                            className="p-2 bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 hover:text-white transition-all text-red-400 btn-interactive"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedBookingRoom(room)}
                      className="w-full py-2.5 bg-black text-white rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-black/85 transition-all shadow-md active:scale-95 btn-interactive"
                    >
                      Check In
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : activeSubTab === "bookings" ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20"
                size={18}
              />
              <input
                type="text"
                placeholder="Search bookings by guest or room..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-black/5 rounded-2xl outline-none focus:border-black/10 transition-all shadow-sm text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-225">
                <thead>
                  <tr className="bg-[#F9F9F8] border-b border-black/5">
                    <th className="p-6 text-[10px] font-mono uppercase text-black/40 tracking-widest">
                      Guest Detail
                    </th>
                    <th className="p-6 text-[10px] font-mono uppercase text-black/40 tracking-widest">
                      Stay Period
                    </th>
                    <th className="p-6 text-[10px] font-mono uppercase text-black/40 tracking-widest">
                      Unit Details
                    </th>
                    <th className="p-6 text-[10px] font-mono uppercase text-black/40 tracking-widest">
                      Payment
                    </th>
                    <th className="p-6 text-[10px] font-mono uppercase text-black/40 tracking-widest text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {searchedBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                            <ClipboardList
                              size={18}
                              className="text-black/40"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-[#141414]">
                              {booking.guest_name}
                            </p>
                            <p className="text-[10px] font-mono text-black/30">
                              {booking.guest_email || "No email provided"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium">
                              {format(parseISO(booking.check_in), "dd MMM")}
                            </span>
                            <span className="text-black/20">â†’</span>
                            <span className="font-medium">
                              {format(parseISO(booking.check_out), "dd MMM")}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-black/30 uppercase">
                            {differenceInDays(
                              parseISO(booking.check_out),
                              parseISO(booking.check_in),
                            )}{" "}
                            Nights
                          </p>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="text-center bg-gray-50 px-3 py-2 rounded-xl border border-black/5">
                            <p className="text-[8px] font-mono uppercase text-black/30">
                              Unit
                            </p>
                            <p className="font-serif italic font-bold">
                              {booking.room_number}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-lg text-[9px] font-mono uppercase
                            ${
                              booking.status === "Active" ||
                              booking.status === "Checked In"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : "bg-orange-50 text-orange-600 border border-orange-100"
                            }`}
                          >
                            {booking.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-6">
                        <p className="font-serif italic text-sm font-bold">
                          N$ {booking.total_price}
                        </p>
                        <p className="text-[9px] font-mono uppercase text-black/30">
                          via {booking.payment_method || "N/A"}
                        </p>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedFolioBooking(booking)}
                            className="p-2.5 bg-black text-white rounded-xl hover:bg-black/80 transition-all shadow-md flex items-center gap-2"
                            title="Guest Folio"
                          >
                            <Receipt size={14} />
                            <span className="text-[9px] font-mono uppercase tracking-widest">
                              Folio
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeSubTab === "calendar" ? (
        <BookingCalendar rooms={rooms} bookings={bookings} />
      ) : (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-serif italic">
                Accommodation Portfolio
              </h3>
              <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest max-w-xs text-right">
                Global services and add-ons available for selection during room
                check-in.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolioServices.map((service) => (
                <div
                  key={service.id}
                  className="p-6 bg-gray-50 rounded-2xl border border-black/5 flex justify-between items-center group hover:bg-white hover:border-black/10 transition-all"
                >
                  <div>
                    <h4 className="font-medium text-[#141414]">
                      {service.name}
                    </h4>
                    <p className="text-xs font-serif italic text-black/40 mt-1">
                      N$ {service.price}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => deletePortfolioService(service.id)}
                      className="p-2 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {canManage && (
                <button
                  onClick={() => setIsAddingPref(true)}
                  className="p-6 rounded-2xl border border-dashed border-black/10 flex items-center justify-center gap-3 text-black/20 hover:text-black/40 hover:border-black/20 transition-all group"
                >
                  <Plus
                    size={20}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span className="text-xs font-mono uppercase tracking-widest">
                    Add Global Service
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking and Folio Modals */}
      <AnimatePresence>
        {selectedBookingRoom && (
          <BookingModal
            room={selectedBookingRoom}
            onClose={() => setSelectedBookingRoom(null)}
            onSuccess={(msg) => {
              setSelectedBookingRoom(null);
              // Handle toast if needed
            }}
          />
        )}
        {selectedFolioBooking && (
          <FolioModal
            booking={selectedFolioBooking}
            rooms={rooms}
            folio={folios.find((f) => f.booking_id === selectedFolioBooking.id)}
            onClose={() => setSelectedFolioBooking(null)}
          />
        )}
      </AnimatePresence>

      {/* Add/Edit Room Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] p-10 shadow-2xl border border-black/5 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h3 className="text-3xl font-serif italic text-[#141414]">
                    {editingRoomId ? "Modify Registry" : "New Unit Entry"}
                  </h3>
                  <p className="text-[10px] font-mono text-black/30 uppercase tracking-[0.3em] mt-2">
                    Accommodation Management System
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingRoomId(null);
                  }}
                  className="p-3 bg-black/5 hover:bg-black/10 rounded-full transition-colors text-black/40"
                >
                  <X size={24} />
                </button>
              </div>

              <form
                onSubmit={handleAddRoom}
                className="grid grid-cols-1 lg:grid-cols-2 gap-12"
              >
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40 ml-1">
                        Prefix
                      </label>
                      <select
                        value={newRoom.prefix}
                        onChange={(e) =>
                          setNewRoom({ ...newRoom, prefix: e.target.value })
                        }
                        className="w-full px-5 py-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm font-bold text-black/60 focus:bg-white focus:border-black/10 transition-all"
                      >
                        <option value="SR">SR (Single)</option>
                        <option value="DR">DR (Double)</option>
                        <option value="VR">VR (VIP)</option>
                        <option value="RM">RM (General)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40 ml-1">
                        Unit Number
                      </label>
                      <input
                        type="text"
                        required
                        value={newRoom.number}
                        onChange={(e) =>
                          setNewRoom({ ...newRoom, number: e.target.value })
                        }
                        className="w-full px-5 py-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-black/10 transition-all"
                        placeholder="e.g. 101"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40 ml-1">
                      Suite Category
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { cat: "Single", price: 450, prefix: "SR" },
                        { cat: "Double", price: 550, prefix: "DR" },
                        { cat: "VIP", price: 750, prefix: "VR" },
                      ].map(({ cat, price, prefix }) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setNewRoom({
                              ...newRoom,
                              category: cat as any,
                              price: price,
                              prefix: prefix,
                            })
                          }
                          className={`py-3 rounded-xl border text-[10px] font-mono uppercase tracking-widest transition-all
                            ${newRoom.category === cat ? "bg-black text-white border-black" : "bg-gray-50 text-black/40 border-black/5"}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40 ml-1">
                        Nightly Rate (N$)
                      </label>
                      <input
                        type="number"
                        required
                        value={newRoom.price}
                        onChange={(e) =>
                          setNewRoom({
                            ...newRoom,
                            price: parseNumberInput(e.target.value),
                          })
                        }
                        className="w-full px-5 py-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-black/10 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40 ml-1">
                        Registry Status
                      </label>
                      <select
                        value={newRoom.status}
                        onChange={(e) =>
                          setNewRoom({
                            ...newRoom,
                            status: e.target.value as any,
                          })
                        }
                        className="w-full px-5 py-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm font-bold text-black/60 focus:bg-white focus:border-black/10 transition-all"
                      >
                        <option value="Available">Available</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Cleaning">Cleaning</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40 ml-1">
                      Brief Description
                    </label>
                    <textarea
                      value={newRoom.description}
                      onChange={(e) =>
                        setNewRoom({ ...newRoom, description: e.target.value })
                      }
                      rows={3}
                      className="w-full px-5 py-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm focus:bg-white focus:border-black/10 transition-all resize-none"
                      placeholder="Highlight key features..."
                    />
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="bg-[#F9F9F8] p-8 rounded-3xl border border-black/5">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-black/40">
                        Unit Services
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono uppercase text-emerald-600 font-bold">
                          {newRoom.breakfastIncluded ? "Breakfast Active" : ""}
                        </span>
                        <input
                          type="checkbox"
                          checked={newRoom.breakfastIncluded}
                          onChange={(e) =>
                            setNewRoom({
                              ...newRoom,
                              breakfastIncluded: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-black/10 text-black focus:ring-black"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {newRoom.additionalServices.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-black/5 group hover:bg-black hover:text-white transition-all duration-300"
                        >
                          <span className="text-xs font-medium">{s.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-mono">
                              N$ {s.price}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setNewRoom({
                                  ...newRoom,
                                  additionalServices:
                                    newRoom.additionalServices.filter(
                                      (_, idx) => idx !== i,
                                    ),
                                })
                              }
                              className="text-red-500/40 group-hover:text-white transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Link from Portfolio */}
                    {portfolioServices.filter(
                      (p) =>
                        !newRoom.additionalServices.some(
                          (s) => s.name === p.name,
                        ),
                    ).length > 0 && (
                      <div className="mt-6 pt-6 border-t border-black/5">
                        <p className="text-[8px] font-mono uppercase text-black/20 mb-3 tracking-widest">
                          Available from Portfolio
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {portfolioServices
                            .filter(
                              (p) =>
                                !newRoom.additionalServices.some(
                                  (s) => s.name === p.name,
                                ),
                            )
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  setNewRoom({
                                    ...newRoom,
                                    additionalServices: [
                                      ...newRoom.additionalServices,
                                      { name: p.name, price: p.price },
                                    ],
                                  })
                                }
                                className="px-3 py-1.5 bg-black/5 hover:bg-black hover:text-white rounded-lg text-[9px] font-mono uppercase transition-all flex items-center gap-2"
                              >
                                <Plus size={10} /> {p.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddRoom()}
                      className="w-full py-5 bg-black text-white rounded-2xl font-medium shadow-2xl shadow-black/20 hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-[0.3em] font-mono"
                    >
                      {editingRoomId
                        ? "Update Live Registry"
                        : "Commit to Database"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingPref && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic text-blue-900">
                  New Portfolio Service
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPref(false);
                    setPortfolioFormError(null);
                  }}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddPortfolioService} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newPref.name}
                    onChange={(e) =>
                      setNewPref({ ...newPref, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Base Price (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newPref.price}
                    onChange={(e) =>
                      setNewPref({ ...newPref, price: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none"
                  />
                </div>
                {portfolioFormError && (
                  <p className="text-red-500 text-[10px] font-mono italic">
                    {portfolioFormError}
                  </p>
                )}
                <button
                  disabled={isSavingPref}
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium mt-4 hover:bg-blue-700 transition-all"
                >
                  {isSavingPref ? "Saving..." : "Add to Portfolio"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
