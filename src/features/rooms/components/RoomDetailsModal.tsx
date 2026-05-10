import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { X, CheckCircle2, Calendar as CalendarIcon } from "lucide-react";
import {
  Room,
  RoomBooking,
  GlobalPreference,
} from "../../../shared/types/hotel";
import {
  format,
  addDays,
  differenceInDays,
  startOfDay,
  parseISO,
} from "date-fns";

interface RoomDetailsModalProps {
  selectedRoom: Room;
  roomBookings: RoomBooking[];
  onClose: () => void;
  onCheckIn: (
    room: Room,
    options: {
      includeBreakfast: boolean;
      selectedAddons: string[];
      checkInDate: string;
      checkOutDate: string;
    },
  ) => Promise<void>;
  globalPreferences?: GlobalPreference[];
  getRoomImage: (room: Room) => string;
}

export const RoomDetailsModal = ({
  selectedRoom,
  roomBookings,
  onClose,
  onCheckIn,
  globalPreferences = [],
  getRoomImage,
}: RoomDetailsModalProps) => {
  const [includeBreakfast, setIncludeBreakfast] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);

  const nights = useMemo(() => {
    const start = startOfDay(parseISO(checkInDate));
    const end = startOfDay(parseISO(checkOutDate));
    const diff = differenceInDays(end, start);
    return Math.max(1, diff);
  }, [checkInDate, checkOutDate]);

  const totalPrice = useMemo(() => {
    const basePrice = selectedRoom.price * nights;
    const breakfastPrice = includeBreakfast
      ? (selectedRoom.breakfastPrice || 0) * nights
      : 0;

    const addonsFromRoom = (selectedRoom.additionalServices || [])
      .filter((s) => selectedAddons.includes(s.name))
      .reduce((sum, s) => sum + s.price, 0);

    const addonsFromGlobal = (globalPreferences || [])
      .filter((s) => selectedAddons.includes(s.name))
      .reduce((sum, s) => sum + s.price, 0);

    return basePrice + breakfastPrice + addonsFromRoom + addonsFromGlobal;
  }, [
    selectedRoom,
    includeBreakfast,
    selectedAddons,
    globalPreferences,
    nights,
  ]);

  const isDateRangeAvailable = useMemo(() => {
    const start = parseISO(checkInDate);
    const end = parseISO(checkOutDate);

    return !roomBookings.some((booking) => {
      if (booking.room_id !== selectedRoom.id) return false;
      if (booking.status === "Cancelled") return false;

      const bStart = parseISO(booking.check_in.split("T")[0]);
      const bEnd = parseISO(booking.check_out.split("T")[0]);

      // Overlap check: (start < bEnd) && (end > bStart)
      return isBefore(start, bEnd) && isBefore(bStart, end);
    });
  }, [checkInDate, checkOutDate, roomBookings, selectedRoom.id]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-60">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-4xl border border-black/5 flex flex-col md:flex-row max-h-[90vh]"
      >
        <div className="md:w-1/2 md:h-auto aspect-square md:aspect-auto relative bg-gray-100">
          <img
            src={getRoomImage(selectedRoom)}
            alt={`Room ${selectedRoom.number}`}
            className="w-full h-full object-cover absolute inset-0"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full text-black hover:bg-white transition-colors md:hidden"
          >
            <X size={20} />
          </button>
        </div>
        <div className="md:w-1/2 p-8 flex flex-col overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-black text-white rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.3em] leading-none shadow-xl">
                    {selectedRoom.number.match(/^[A-Z]+/)?.[0] || "RM"}
                  </span>
                  <span className="text-[12px] font-mono text-black/30 font-medium uppercase tracking-[0.25em] border-l border-black/10 pl-4">
                    {selectedRoom.category} REGISTRY
                  </span>
                </div>
                <h3 className="text-8xl font-serif font-black tracking-tighter text-[#141414] leading-none">
                  {selectedRoom.number.replace(/^[A-Z]+/, "")}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="hidden md:block p-2 text-black/20 hover:text-black transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-black/40 mb-2">
                Description
              </h4>
              <p className="text-sm text-black/70 leading-relaxed">
                {selectedRoom.description ||
                  "Experience comfort and style in our carefully curated rooms."}
              </p>
            </div>

            {/* Date Selection Section */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-black/5 rounded-2xl">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-black/40 flex items-center gap-2">
                  <CalendarIcon size={12} /> Check In
                </label>
                <input
                  type="date"
                  min={today}
                  value={checkInDate}
                  onChange={(e) => {
                    setCheckInDate(e.target.value);
                    if (
                      isBefore(parseISO(checkOutDate), parseISO(e.target.value))
                    ) {
                      setCheckOutDate(
                        format(
                          addDays(parseISO(e.target.value), 1),
                          "yyyy-MM-dd",
                        ),
                      );
                    }
                  }}
                  className="w-full bg-transparent text-sm font-medium focus:outline-none"
                />
              </div>
              <div className="space-y-2 border-l border-black/10 pl-4">
                <label className="text-[10px] font-mono uppercase tracking-widest text-black/40 flex items-center gap-2">
                  <CalendarIcon size={12} /> Check Out
                </label>
                <input
                  type="date"
                  min={format(addDays(parseISO(checkInDate), 1), "yyyy-MM-dd")}
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            {!isDateRangeAvailable && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium flex items-center gap-2">
                <X size={14} />
                Selected dates overlap with an existing booking.
              </div>
            )}

            {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-black/40 mb-2">
                  Amenities
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedRoom.amenities.map((amenity, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-black/60"
                    >
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-black/5 mt-auto space-y-6">
              <div className="space-y-4 bg-gray-50 p-4 rounded-2xl">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-black/40">
                  Optional Services & Portfolio
                </h4>

                {/* Breakfast Option */}
                {selectedRoom.breakfastPrice !== undefined &&
                  selectedRoom.breakfastPrice > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="breakfastOpt"
                          checked={includeBreakfast}
                          onChange={(e) =>
                            setIncludeBreakfast(e.target.checked)
                          }
                          className="rounded border-black/10"
                        />
                        <label
                          htmlFor="breakfastOpt"
                          className="text-xs font-medium"
                        >
                          Add Daily Breakfast (N$ {selectedRoom.breakfastPrice}{" "}
                          / day)
                        </label>
                      </div>
                      <span className="text-xs font-serif italic text-black/60">
                        + N$ {selectedRoom.breakfastPrice * nights}
                      </span>
                    </div>
                  )}

                {/* Room Specific Addons */}
                {selectedRoom.additionalServices?.map((s, i) => (
                  <div
                    key={`room-addon-${i}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`addon-${i}`}
                        checked={selectedAddons.includes(s.name)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedAddons([...selectedAddons, s.name]);
                          else
                            setSelectedAddons(
                              selectedAddons.filter((a) => a !== s.name),
                            );
                        }}
                        className="rounded border-black/10"
                      />
                      <label
                        htmlFor={`addon-${i}`}
                        className="text-xs font-medium"
                      >
                        {s.name}
                      </label>
                    </div>
                    <span className="text-xs font-serif italic text-black/60">
                      + N$ {s.price}
                    </span>
                  </div>
                ))}

                {/* Global Portfolio Services */}
                {globalPreferences &&
                  globalPreferences.length > 0 &&
                  globalPreferences
                    .filter(
                      (g) =>
                        !(selectedRoom.additionalServices || []).some(
                          (s) => s.name === g.name,
                        ),
                    )
                    .map((g, gi) => (
                      <div
                        key={`global-addon-${gi}`}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`global-addon-${gi}`}
                            checked={selectedAddons.includes(g.name)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedAddons([...selectedAddons, g.name]);
                              else
                                setSelectedAddons(
                                  selectedAddons.filter((a) => a !== g.name),
                                );
                            }}
                            className="rounded border-black/10"
                          />
                          <label
                            htmlFor={`global-addon-${gi}`}
                            className="text-xs font-medium"
                          >
                            {g.name}
                          </label>
                        </div>
                        <span className="text-xs font-serif italic text-black/60">
                          + N$ {g.price}
                        </span>
                      </div>
                    ))}
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
                    Total Stay Value ({nights}{" "}
                    {nights === 1 ? "night" : "nights"})
                  </p>
                  <p className="text-3xl font-serif italic text-black">
                    N$ {totalPrice}
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase ${
                    isDateRangeAvailable
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {isDateRangeAvailable
                    ? "Dates Available"
                    : "Dates Unavailable"}
                </div>
              </div>
              <button
                disabled={!isDateRangeAvailable}
                onClick={() =>
                  onCheckIn(selectedRoom, {
                    includeBreakfast,
                    selectedAddons,
                    checkInDate,
                    checkOutDate,
                  })
                }
                className="w-full py-4 bg-black text-white rounded-2xl font-medium disabled:opacity-30 hover:bg-black/90 transition-all shadow-xl shadow-black/10"
              >
                {isDateRangeAvailable
                  ? "Confirm Check In"
                  : "Dates Unavailable"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
