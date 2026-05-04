import React, { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { Room, RoomBooking } from "../../../shared/types/hotel";
import { motion } from "motion/react";

interface BookingCalendarProps {
  rooms: Room[];
  bookings: RoomBooking[];
}

export const BookingCalendar = ({ rooms, bookings }: BookingCalendarProps) => {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBookingForRoomAndDay = (roomId: string, day: Date) => {
    return bookings.find(b => {
      if (
        b.room_id !== roomId ||
        (b.status !== "Confirmed" && b.status !== "Checked In")
      ) {
        return false;
      }
      const start = parseISO(b.check_in.split('T')[0]);
      const end = parseISO(b.check_out.split('T')[0]);
      return isWithinInterval(day, { start, end });
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col h-[600px]">
      <div className="p-6 border-b border-black/5 bg-gray-50 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-serif italic text-[#141414]">Occupancy Roadmap</h3>
          <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
            {format(new Date(), "MMMM yyyy")} • Visual Availability Registry
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-mono uppercase text-black/40">In House</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-[10px] font-mono uppercase text-black/40">Confirmed</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-white shadow-sm">
            <tr>
              <th className="p-4 bg-white border-r border-b border-black/5 text-[10px] font-mono uppercase text-black/40 min-w-[120px] sticky left-0 z-30">
                Room Registry
              </th>
              {days.map(day => (
                <th
                  key={day.toISOString()}
                  className={`p-2 border-b border-black/5 text-center min-w-[40px] ${isSameDay(day, new Date()) ? 'bg-black text-white' : 'text-black/40'}`}
                >
                  <div className="text-[10px] font-mono uppercase">{format(day, "eee")}</div>
                  <div className="text-xs font-bold">{format(day, "dd")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.sort((a, b) => a.number.localeCompare(b.number)).map(room => (
              <tr key={room.id} className="group">
                <td className="p-4 border-r border-b border-black/5 bg-white font-mono text-xs font-bold text-black/60 sticky left-0 z-10 group-hover:bg-gray-50">
                  {room.number}
                </td>
                {days.map(day => {
                  const booking = getBookingForRoomAndDay(room.id, day);
                  const isStart = booking && isSameDay(parseISO(booking.check_in.split('T')[0]), day);

                  return (
                    <td key={day.toISOString()} className="p-0 border-b border-black/5 h-12 relative group-hover:bg-gray-50/50">
                      {booking && (
                        <div
                          className={`absolute inset-y-2 inset-x-0 mx-[-1px] rounded-sm transition-all shadow-sm flex items-center px-2 overflow-hidden
                            ${booking.status === "Checked In" || booking.status === "Active" ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        >
                          {isStart && (
                            <span className="text-[8px] text-white font-bold whitespace-nowrap uppercase tracking-tighter">
                              {booking.guest_name}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
