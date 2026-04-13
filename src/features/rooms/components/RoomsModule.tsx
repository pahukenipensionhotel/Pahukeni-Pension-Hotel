import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Edit2, Trash2, X, ClipboardList } from "lucide-react";
import { doc, updateDoc, addDoc, collection, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import { Room, User } from "../../../shared/types/hotel";
import { canManageRooms } from "../../../shared/security/authorization";
import { handleFirestoreError, OperationType } from "../../../shared/validation/inputs";
import { IMAGE_CATALOG } from "../../../shared/assets/imageCatalog";
import { createWorkflowNotification } from "../../notifications/services/notificationWorkflow";

// Helper for local assets in this module (using the same structure as App.tsx used to have)
const LOCAL_ASSETS = {
  rooms: {
    single: IMAGE_CATALOG.rooms.single,
    double: IMAGE_CATALOG.rooms.double,
    doubleAlt: IMAGE_CATALOG.rooms.doubleAlt,
    vip: IMAGE_CATALOG.rooms.vip,
  }
};

const parseNumberInput = (val: string) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

export const RoomsModule = ({
  rooms,
  bookings,
  globalPreferences = [],
  isAdmin,
  userRole,
}: {
  rooms: Room[];
  bookings: any[];
  globalPreferences?: any[];
  isAdmin: boolean;
  userRole?: string;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [portfolioServices, setPortfolioServices] = useState<any[]>(globalPreferences);
  const [newRoom, setNewRoom] = useState({
    number: "",
    category: "Single",
    price: 0,
    status: "Available" as any,
    breakfastIncluded: true,
    breakfastPrice: 150,
    additionalServices: [] as { name: string; price: number }[],
    description: "",
    amenities: [] as string[],
    imageUrl: LOCAL_ASSETS.rooms.single,
    prefix: "SR",
  });

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
        breakfastIncluded: true,
        breakfastPrice: 150,
        additionalServices: [],
        description: "",
        amenities: [],
        imageUrl: LOCAL_ASSETS.rooms.single,
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
      breakfastPrice: room.breakfastPrice ?? 150,
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

  const [activeSubTab, setActiveSubTab] = useState<"rooms" | "bookings" | "services">("rooms");
  const [newPref, setNewPref] = useState({ name: "", price: "" });
  const [isAddingPref, setIsAddingPref] = useState(false);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [portfolioFormError, setPortfolioFormError] = useState<string | null>(null);

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
    if (!normalizedPrice || !Number.isFinite(validatedPrice) || validatedPrice < 0) {
      setPortfolioFormError("Please provide a valid non-negative service price.");
      return;
    }

    try {
      setIsSavingPref(true);
      const docRef = await addDoc(collection(db, "global_preferences"), {
        name: serviceName,
        price: validatedPrice,
        created_at: new Date().toISOString(),
      });
      setPortfolioServices((prev) => [...prev, { id: docRef.id, name: serviceName, price: validatedPrice }]);
      setNewPref({ name: "", price: "" });
      setIsAddingPref(false);

      await createWorkflowNotification({
        role: "Receptionist",
        title: "Global Services Updated",
        message: `New service "${serviceName}" has been added to the portfolio.`,
        type: "system",
      });
    } catch (err) {
      console.error("Firestore Error (Global Preferences):", err);
      setPortfolioFormError(err instanceof Error ? err.message : "Failed to save the portfolio service.");
    } finally {
      setIsSavingPref(false);
    }
  };

  const deletePreference = async (id: string) => {
    try {
      await deleteDoc(doc(db, "global_preferences", id));
      setPortfolioServices((prev) => prev.filter((pref) => pref.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "global_preferences");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-8">
          <h2 className="text-xl md:text-2xl font-serif italic">Room Management</h2>
          <div className="flex bg-white/50 p-1 rounded-xl border border-black/5 w-fit">
            <button
              onClick={() => setActiveSubTab("rooms")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "rooms" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Inventory
            </button>
            <button
              onClick={() => setActiveSubTab("bookings")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "bookings" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Daily Bookings ({bookings.filter((b) => b.status === "Pending").length})
            </button>
            <button
              onClick={() => setActiveSubTab("services")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "services" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Service Portfolio
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canManage && activeSubTab === "rooms" && (
            <button
              onClick={() => {
                setEditingRoomId(null);
                setNewRoom({
                  number: "",
                  category: "Single",
                  price: 0,
                  status: "Available",
                  breakfastIncluded: true,
                  breakfastPrice: 150,
                  additionalServices: [],
                  description: "",
                  amenities: [],
                  imageUrl: LOCAL_ASSETS.rooms.single,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {rooms.map((room) => (
            <motion.div
              key={room.id}
              whileHover={{ y: -4 }}
              className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-lg transition-all relative group"
            >
              <div className="aspect-video mb-4 rounded-xl overflow-hidden bg-gray-100 relative group-hover:shadow-inner">
                <img
                  src={room.imageUrl || LOCAL_ASSETS.rooms.single}
                  alt={`Room ${room.number}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {canManage && (
                    <>
                      <button
                        onClick={() => startEdit(room)}
                        className="p-2 bg-white text-black rounded-lg hover:bg-white/90 transition-all shadow-sm"
                        title="Edit Room"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete Room ${room.number}?`)) {
                            deleteRoom(room.id);
                          }
                        }}
                        className="p-2 bg-white text-red-500 rounded-lg hover:bg-white/90 transition-all shadow-sm"
                        title="Delete Room"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="px-2.5 py-1 bg-[#141414] text-white rounded-[4px] text-[8px] font-mono font-black uppercase tracking-[0.3em] leading-none shadow-lg">
                      {room.number.match(/^[A-Z]+/)?.[0] || "RM"}
                    </span>
                    <span className="text-[9px] font-mono text-black/30 font-bold uppercase tracking-[0.2em] border-l border-black/10 pl-4">
                      UNIT REGISTRY
                    </span>
                  </div>
                  <h3 className="text-6xl font-serif font-black tracking-tighter text-[#141414] leading-none mb-1.5">
                    {room.number.replace(/^[A-Z]+/, "")}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-black/10"></div>
                    <p className="text-[10px] font-mono text-black/50 font-medium uppercase tracking-[0.2em]">
                      {room.category} Standard
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.15em]
                  ${
                    room.status === "Available"
                      ? "bg-emerald-50 text-emerald-700"
                      : room.status === "Occupied"
                        ? "bg-orange-50 text-orange-700"
                        : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {room.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end text-xs pt-4 border-t border-black/[0.03]">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-black/30 font-mono uppercase tracking-widest mb-1">
                      Standard Rate
                    </span>
                    <span className="text-xl font-serif italic font-medium text-black/80">
                      N$ {room.price}
                    </span>
                  </div>
                </div>

                {room.additionalServices && room.additionalServices.length > 0 && (
                  <div className="pt-2 border-t border-black/5">
                    <div className="flex flex-wrap gap-1">
                      {room.additionalServices.map((s, i) => (
                        <span
                          key={i}
                          className="text-[8px] font-mono uppercase px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded border border-blue-100"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-black/50 line-clamp-2 h-7 italic">
                  {room.description || "Premium room with modern essentials..."}
                </p>

                <div className="flex gap-2">
                  {room.status === "Available" ? (
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, "rooms", room.id), { status: "Occupied" });
                      }}
                      className="flex-1 py-2.5 bg-black text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-black/90 transition-all shadow-md shadow-black/10"
                    >
                      Check In
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, "rooms", room.id), { status: "Available" });
                      }}
                      className="flex-1 py-2.5 bg-white text-black border border-black/10 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm"
                    >
                      Check Out
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : activeSubTab === "bookings" ? (
        <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F9F9F8] border-b border-black/5">
                <tr>
                  <th className="p-6 text-[10px] font-mono uppercase text-black/40">Guest</th>
                  <th className="p-6 text-[10px] font-mono uppercase text-black/40">Room</th>
                  <th className="p-6 text-[10px] font-mono uppercase text-black/40">Services</th>
                  <th className="p-6 text-[10px] font-mono uppercase text-black/40">Total Price</th>
                  <th className="p-6 text-[10px] font-mono uppercase text-black/40">Status</th>
                  <th className="p-6 text-[10px] font-mono uppercase text-black/40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {bookings
                  .filter((b: any) => b.status === "Pending")
                  .map((booking: any) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{booking.guest_name}</span>
                          <span className="text-[10px] text-black/40 font-mono">{booking.guest_email}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center text-[10px] font-mono font-bold text-black/40">
                            {booking.room_number.match(/^[A-Z]+/)?.[0] || "RM"}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-serif italic font-medium leading-none">
                              #{booking.room_number.replace(/^[A-Z]+/, "")}
                            </span>
                            <span className="text-[9px] font-mono text-black/30 uppercase tracking-widest mt-1">
                              Confirmed Unit
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          {booking.breakfast_included && (
                            <span className="text-[10px] text-emerald-600 font-mono uppercase tracking-tighter bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                              Breakfast
                            </span>
                          )}
                          {booking.additional_services?.map((svc: string, i: number) => (
                            <span
                              key={i}
                              className="text-[10px] text-blue-600 font-mono uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded w-fit"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="text-sm font-serif italic font-medium">N$ {booking.total_price}</span>
                      </td>
                      <td className="p-6">
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-mono uppercase animate-pulse">
                          Pending
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const batch = writeBatch(db);
                                batch.update(doc(db, "room_bookings", booking.id), { status: "Confirmed" });
                                const bookedRoom = rooms.find((room) => room.number === booking.room_number);
                                if (bookedRoom) {
                                  batch.update(doc(db, "rooms", bookedRoom.id), { status: "Occupied" });
                                }
                                await batch.commit();
                                await createWorkflowNotification({
                                  userId: booking.guest_uid,
                                  title: "Stay Confirmed!",
                                  message: `Your stay in Room ${booking.room_number} is confirmed.`,
                                  type: "system",
                                });
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, "room_bookings");
                              }
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
                          >
                            Confirm & Notify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {bookings.filter((b: any) => b.status === "Pending").length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-black/20 font-mono text-sm italic">
                      No pending booking requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-center gap-6">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
              <ClipboardList size={24} />
            </div>
            <div>
              <h3 className="text-lg font-serif italic text-blue-900 leading-none mb-1">Service Portfolio</h3>
              <p className="text-[11px] font-mono text-blue-700/60 uppercase tracking-widest">
                Global metadata shared across all rooms
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {portfolioServices.map((pref) => (
              <div
                key={pref.id}
                className="bg-white p-5 rounded-2xl border border-black/5 flex justify-between items-center group hover:bg-black hover:text-white transition-all cursor-default relative shadow-sm"
              >
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-tighter mb-1">{pref.name}</h4>
                  <p className="text-lg font-serif italic opacity-60">N$ {pref.price}</p>
                </div>
                {canManage && (
                  <button
                    onClick={() => deletePreference(pref.id)}
                    className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 rounded-lg hover:bg-white/20"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-2xl border border-black/5 my-8"
            >
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-black/5">
                <div>
                  <h3 className="text-2xl font-serif italic text-[#141414]">
                    {editingRoomId ? `Edit Room ${newRoom.number}` : "Register New Room"}
                  </h3>
                  <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
                    Direct Cloud Synchronization Active
                  </p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={24} className="text-black/40" />
                </button>
              </div>

              <form className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-3 font-bold tracking-widest italic">
                      Core Setup
                    </label>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[8px] font-mono uppercase text-black/60 mb-1">Category</label>
                        <select
                          value={newRoom.category}
                          onChange={(e) => {
                            const cat = e.target.value;
                            const newPrefix = cat === "Single" ? "SR" : cat === "Double" ? "DR" : cat === "VIP" ? "VR" : "PR";
                            setNewRoom({
                              ...newRoom,
                              category: cat,
                              prefix: newPrefix,
                              imageUrl: cat === "Single" ? LOCAL_ASSETS.rooms.single : cat === "Double" ? LOCAL_ASSETS.rooms.double : LOCAL_ASSETS.rooms.vip,
                            });
                          }}
                          className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-black/5 outline-none transition-all text-xs"
                        >
                          <option value="Single">Single Room (SR)</option>
                          <option value="Double">Double Room (DR)</option>
                          <option value="VIP">VIP Suite (VR)</option>
                          <option value="Suite">Presidential (PR)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="block text-[8px] font-mono uppercase text-black/60 mb-1">Prefix</label>
                          <select
                            value={newRoom.prefix}
                            onChange={(e) => setNewRoom({ ...newRoom, prefix: e.target.value })}
                            className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none font-mono text-sm"
                          >
                            <option value="SR">SR (Single)</option>
                            <option value="DR">DR (Double)</option>
                            <option value="VR">VR (VIP)</option>
                            <option value="PR">PR (Presidential)</option>
                            <option value="EX">EX (Executive)</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="block text-[8px] font-mono uppercase text-black/60 mb-1">Room #</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 001"
                            value={newRoom.number}
                            onChange={(e) => setNewRoom({ ...newRoom, number: e.target.value })}
                            className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-3 font-bold tracking-widest italic">
                      Pricing & Dining
                    </label>
                    <div className="space-y-4">
                      <div className="relative">
                        <label className="block text-[8px] font-mono uppercase text-black/60 mb-1 pl-1">Nightly Rate (N$)</label>
                        <input
                          type="number"
                          required
                          value={newRoom.price}
                          onChange={(e) => setNewRoom({ ...newRoom, price: parseNumberInput(e.target.value) })}
                          className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none font-medium text-sm"
                        />
                      </div>
                      <div className="p-4 bg-emerald-500/[0.03] rounded-2xl border border-emerald-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="bf-toggle-edit"
                              checked={newRoom.breakfastIncluded}
                              onChange={(e) => setNewRoom({ ...newRoom, breakfastIncluded: e.target.checked })}
                              className="w-4 h-4 rounded-lg border-emerald-500/20 text-emerald-600 focus:ring-emerald-500/20"
                            />
                            <label htmlFor="bf-toggle-edit" className="text-[10px] font-mono uppercase text-emerald-800 font-bold">
                              Standard Breakfast
                            </label>
                          </div>
                          {newRoom.breakfastIncluded && <span className="text-[10px] font-mono text-emerald-600/60 font-bold">ACTIVE</span>}
                        </div>
                        {newRoom.breakfastIncluded && (
                          <div className="flex items-center justify-between pt-2 border-t border-emerald-500/5">
                            <span className="text-[9px] font-mono text-emerald-700/50 uppercase">Service Price</span>
                            <input
                              type="number"
                              value={newRoom.breakfastPrice}
                              onChange={(e) => setNewRoom({ ...newRoom, breakfastPrice: parseNumberInput(e.target.value) })}
                              className="w-20 p-1 bg-transparent border-b border-emerald-500/10 text-right text-xs font-mono focus:border-emerald-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest italic">
                      Inventory Media
                    </label>
                    <input
                      type="text"
                      placeholder="Image URL for the room gallery..."
                      value={newRoom.imageUrl}
                      onChange={(e) => setNewRoom({ ...newRoom, imageUrl: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none text-[9px] text-black/40 font-mono italic"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-3 font-bold tracking-widest italic">
                      Room Description
                    </label>
                    <textarea
                      placeholder="Craft a compelling description..."
                      value={newRoom.description}
                      onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                      className="w-full h-28 p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-xs leading-relaxed italic text-black/70 resize-none font-serif"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-black/5">
                      <label className="block text-[10px] font-mono uppercase text-black/40 font-bold tracking-widest">Premium Metadata</label>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const [name, price] = val.split("|");
                            if (!newRoom.additionalServices.find((s) => s.name === name)) {
                              setNewRoom({
                                ...newRoom,
                                additionalServices: [...newRoom.additionalServices, { name, price: parseNumberInput(price) }],
                              });
                            }
                          }
                          e.target.value = "";
                        }}
                        className="text-[9px] font-mono uppercase bg-black text-white px-3 py-1.5 rounded-lg outline-none cursor-pointer tracking-tighter"
                      >
                        <option value="">+ Add Service</option>
                        {portfolioServices.map((pref) => (
                          <option key={pref.id} value={`${pref.name}|${pref.price}`}>
                            {pref.name} (N$ {pref.price})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {newRoom.additionalServices.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-2.5 bg-black/[0.02] border border-black/5 rounded-xl text-[10px] font-mono group hover:bg-black hover:text-white transition-all cursor-default"
                        >
                          <span className="font-bold tracking-tight">{s.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="opacity-40">N$ {s.price}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setNewRoom({
                                  ...newRoom,
                                  additionalServices: newRoom.additionalServices.filter((_, idx) => idx !== i),
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
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddRoom()}
                      className="w-full py-5 bg-black text-white rounded-2xl font-medium shadow-2xl shadow-black/20 hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-[0.3em] font-mono"
                    >
                      {editingRoomId ? "Update Live Registry" : "Commit to Database"}
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
                <h3 className="text-xl font-serif italic text-blue-900">New Portfolio Service</h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPref(false);
                    setPortfolioFormError(null);
                    setNewPref({ name: "", price: "" });
                  }}
                  className="text-black/20 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddPortfolioService();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Service Name</label>
                  <input
                    type="text"
                    required
                    value={newPref.name}
                    onChange={(e) => {
                      setPortfolioFormError(null);
                      setNewPref({ ...newPref, name: e.target.value });
                    }}
                    placeholder="e.g. Guided City Tour"
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Standard Price (N$)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newPref.price}
                    onChange={(e) => {
                      setPortfolioFormError(null);
                      setNewPref({ ...newPref, price: e.target.value });
                    }}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl outline-none"
                  />
                </div>
                {portfolioFormError && <p className="text-sm text-red-600">{portfolioFormError}</p>}
                <button
                  type="submit"
                  disabled={isSavingPref}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium mt-4 shadow-lg shadow-blue-900/10 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingPref ? "Saving Portfolio Service..." : "Register Service Portfolio"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
