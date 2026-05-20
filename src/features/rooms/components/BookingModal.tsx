import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, User, CreditCard, Phone, Globe } from "lucide-react";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import { Room, User as HotelUser } from "../../../shared/types/hotel";
import { logger } from "../../../shared/utils/logger";

interface BookingModalProps {
  room: Room;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const BookingModal = ({
  room,
  onClose,
  onSuccess,
}: BookingModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    guestName: "",
    guestEmail: "",
    guestIdNumber: "",
    source: "Walk-in" as any,
    paymentMethod: "Cash" as "Cash" | "Card",
    checkIn: format(new Date(), "yyyy-MM-dd"),
    checkOut: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    breakfastOption: "single" as "none" | "single" | "sharing",
  });

  const nights = Math.max(
    1,
    differenceInDays(parseISO(formData.checkOut), parseISO(formData.checkIn)),
  );
  const roomTotal = room.price * nights;

  let breakfastTotal = 0;
  if (formData.breakfastOption === "single") {
    breakfastTotal = 100 * nights;
  } else if (formData.breakfastOption === "sharing") {
    breakfastTotal = 200 * nights;
  }

  const finalPrice = roomTotal + breakfastTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const batch = writeBatch(db);

      // 1. Create Booking
      const bookingData = {
        room_id: room.id,
        room_number: room.number,
        guest_name: formData.guestName,
        guest_email: formData.guestEmail,
        guest_id_number: formData.guestIdNumber,
        guest_uid: "offline-guest", // Placeholder for non-portal guests
        source: formData.source,
        payment_method: formData.paymentMethod,
        total_price: finalPrice,
        breakfast_included: formData.breakfastOption !== "none",
        breakfast_type: formData.breakfastOption,
        additional_services: [],
        status: "Checked In",
        check_in: new Date(formData.checkIn).toISOString(),
        check_out: new Date(formData.checkOut).toISOString(),
        created_at: new Date().toISOString(),
      };

      const bookingRef = doc(collection(db, "room_bookings"));
      batch.set(bookingRef, bookingData);

      // 2. Create Folio
      const folioRef = doc(db, "folios", bookingRef.id);
      batch.set(folioRef, {
        id: bookingRef.id,
        booking_id: bookingRef.id,
        charges: [],
        deposits: [],
        total_charges: 0,
        total_deposits: 0,
        balance_due: finalPrice,
      });

      // 3. Update Room Status
      const roomRef = doc(db, "rooms", room.id);
      batch.update(roomRef, { status: "Occupied" });

      await batch.commit();

      await logger.info(
        "BOOKING",
        "STAFF_NEW_BOOKING",
        `Staff created ${formData.source} booking for ${formData.guestName} in Room ${room.number}`,
        undefined,
        "Staff User",
        { bookingId: bookingRef.id, roomNumber: room.number },
      );

      onSuccess(`Check-in successful for Room ${room.number}`);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-2xl border border-black/5"
      >
        <div className="p-8 border-b border-black/5 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-2xl font-serif italic text-[#141414]">
              New Check-In
            </h3>
            <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
              Room {room.number} • {room.category} Registry
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-xl transition-colors"
          >
            <X size={24} className="text-black/40" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest">
                  Guest Identity
                </label>
                <div className="space-y-4">
                  <div className="relative">
                    <User
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20"
                      size={16}
                    />
                    <input
                      required
                      type="text"
                      placeholder="Guest Full Name"
                      value={formData.guestName}
                      onChange={(e) =>
                        setFormData({ ...formData, guestName: e.target.value })
                      }
                      className="w-full pl-10 p-3 bg-gray-50 border border-black/5 rounded-xl outline-none text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Globe
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20"
                      size={16}
                    />
                    <input
                      required
                      type="email"
                      placeholder="Email Address"
                      value={formData.guestEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, guestEmail: e.target.value })
                      }
                      className="w-full pl-10 p-3 bg-gray-50 border border-black/5 rounded-xl outline-none text-sm"
                    />
                  </div>
                  <div className="relative">
                    <CreditCard
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20"
                      size={16}
                    />
                    <input
                      required
                      type="text"
                      placeholder="ID / Passport Number"
                      value={formData.guestIdNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          guestIdNumber: e.target.value,
                        })
                      }
                      className="w-full pl-10 p-3 bg-gray-50 border border-black/5 rounded-xl outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest">
                  Booking Source
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Walk-in", "Phone", "WhatsApp"].map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, source: src as any })
                      }
                      className={`py-2 px-3 rounded-xl border text-[10px] font-mono uppercase transition-all ${
                        formData.source === src
                          ? "bg-black text-white border-black"
                          : "bg-gray-50 text-black/40 border-black/5 hover:border-black/20"
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Cash", "Card"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, paymentMethod: method })
                      }
                      className={`py-2 px-3 rounded-xl border text-[10px] font-mono uppercase transition-all ${
                        formData.paymentMethod === method
                          ? "bg-black text-white border-black"
                          : "bg-gray-50 text-black/40 border-black/5 hover:border-black/20"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest">
                  Stay Duration
                </label>
                <div className="space-y-4">
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20"
                      size={16}
                    />
                    <input
                      type="date"
                      required
                      value={formData.checkIn}
                      onChange={(e) =>
                        setFormData({ ...formData, checkIn: e.target.value })
                      }
                      className="w-full pl-10 p-3 bg-gray-50 border border-black/5 rounded-xl outline-none text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20"
                      size={16}
                    />
                    <input
                      type="date"
                      required
                      min={formData.checkIn}
                      value={formData.checkOut}
                      onChange={(e) =>
                        setFormData({ ...formData, checkOut: e.target.value })
                      }
                      className="w-full pl-10 p-3 bg-gray-50 border border-black/5 rounded-xl outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                <label className="block text-[10px] font-mono uppercase text-emerald-800/60 mb-3 font-bold tracking-widest">
                  Breakfast Selection
                </label>
                <div className="flex flex-col gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, breakfastOption: "none" })
                    }
                    className={`p-2 rounded-lg border text-[10px] font-mono uppercase transition-all ${
                      formData.breakfastOption === "none"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-emerald-800/40 border-emerald-100 hover:border-emerald-300"
                    }`}
                  >
                    No Breakfast (N$ 0)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, breakfastOption: "single" })
                    }
                    className={`p-2 rounded-lg border text-[10px] font-mono uppercase transition-all ${
                      formData.breakfastOption === "single"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-emerald-800/40 border-emerald-100 hover:border-emerald-300"
                    }`}
                  >
                    Single Breakfast (N$ 100)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, breakfastOption: "sharing" })
                    }
                    className={`p-2 rounded-lg border text-[10px] font-mono uppercase transition-all ${
                      formData.breakfastOption === "sharing"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-emerald-800/40 border-emerald-100 hover:border-emerald-300"
                    }`}
                  >
                    Sharing Breakfast (N$ 200)
                  </button>
                </div>
                <div className="space-y-2 pt-4 border-t border-emerald-200/50">
                  <div className="flex justify-between text-[10px] font-mono uppercase text-emerald-800/60">
                    <span>
                      {nights} Nights @ N$ {room.price}
                    </span>
                    <span>N$ {roomTotal}</span>
                  </div>
                  {formData.breakfastOption !== "none" && (
                    <div className="flex justify-between text-[10px] font-mono uppercase text-emerald-800/60">
                      <span>Breakfast ({formData.breakfastOption})</span>
                      <span>N$ {breakfastTotal}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 text-sm font-serif italic font-bold text-emerald-900">
                    <span>Total Due</span>
                    <span>N$ {finalPrice}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-black/90 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Complete Check-In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
