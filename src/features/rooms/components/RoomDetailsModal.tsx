import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle2 } from "lucide-react";
import { Room, Notification } from "../../../shared/types/hotel";

interface RoomDetailsModalProps {
  selectedRoom: Room;
  onClose: () => void;
  onCheckIn: (
    room: Room,
    options: { includeBreakfast: boolean; selectedAddons: string[] },
  ) => Promise<void>;
  globalPreferences?: any[];
  getRoomImage: (room: Room) => string;
}

export const RoomDetailsModal = ({
  selectedRoom,
  onClose,
  onCheckIn,
  globalPreferences = [],
  getRoomImage,
}: RoomDetailsModalProps) => {
  const [includeBreakfast, setIncludeBreakfast] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const totalPrice = useMemo(() => {
    const basePrice = selectedRoom.price;
    const breakfastPrice = includeBreakfast
      ? selectedRoom.breakfastPrice || 0
      : 0;

    const addonsFromRoom = (selectedRoom.additionalServices || [])
      .filter((s) => selectedAddons.includes(s.name))
      .reduce((sum, s) => sum + s.price, 0);

    const addonsFromGlobal = (globalPreferences || [])
      .filter((s) => selectedAddons.includes(s.name))
      .reduce((sum, s) => sum + s.price, 0);

    return basePrice + breakfastPrice + addonsFromRoom + addonsFromGlobal;
  }, [selectedRoom, includeBreakfast, selectedAddons, globalPreferences]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
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
                  <span className="px-3 py-1 bg-black text-white rounded-[4px] text-[10px] font-mono font-bold uppercase tracking-[0.3em] leading-none shadow-xl">
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
                          Add Daily Breakfast
                        </label>
                      </div>
                      <span className="text-xs font-serif italic text-black/60">
                        + N$ {selectedRoom.breakfastPrice}
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
                    Total Stay Value
                  </p>
                  <p className="text-3xl font-serif italic text-black">
                    N$ {totalPrice}
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase ${
                    selectedRoom.status === "Available"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-orange-50 text-orange-700"
                  }`}
                >
                  {selectedRoom.status}
                </div>
              </div>
              <button
                disabled={selectedRoom.status !== "Available"}
                onClick={() =>
                  onCheckIn(selectedRoom, { includeBreakfast, selectedAddons })
                }
                className="w-full py-4 bg-black text-white rounded-2xl font-medium disabled:opacity-30 hover:bg-black/90 transition-all shadow-xl shadow-black/10"
              >
                {selectedRoom.status === "Available"
                  ? "Confirm Check In"
                  : "Currently Unavailable"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
