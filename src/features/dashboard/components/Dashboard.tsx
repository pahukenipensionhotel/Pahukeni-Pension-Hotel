import {
  Users,
  Bed,
  WashingMachine,
  FileText,
  Clock,
  ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";
import type { Stats } from "../../../shared/types/hotel";

export function Dashboard({
  stats,
  bookings,
}: {
  stats: Stats | null;
  bookings: any[];
}) {
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
      </div>
    </div>
  );
}
