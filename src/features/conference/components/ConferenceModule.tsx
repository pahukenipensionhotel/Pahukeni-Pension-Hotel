import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus } from "lucide-react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import { User } from "../../../shared/types/hotel";
import { canManageConference } from "../../../shared/security/authorization";
import {
  handleFirestoreError,
  OperationType,
  parseNumberInput,
} from "../../../shared/validation/inputs";
import { IMAGE_CATALOG } from "../../../shared/assets/imageCatalog";

const LOCAL_ASSETS = IMAGE_CATALOG;

export const ConferenceModule = ({
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
          loading="lazy"
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
                  loading="lazy"
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
