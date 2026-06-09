import React, { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from "date-fns";
import { ConferenceRoom, ConferenceBooking } from "../../../shared/types/hotel";

interface ConferenceCalendarProps {
  rooms: ConferenceRoom[];
  bookings: ConferenceBooking[];
}

export const ConferenceCalendar = ({ rooms, bookings }: ConferenceCalendarProps) => {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBookingsForRoomAndDay = (roomId: string, day: Date) => {
    return bookings.filter((b) => {
      if (
        b.room_id !== roomId ||
        (b.status !== "Confirmed" && b.status !== "Checked In" && b.status !== "Pending")
      ) {
        return false;
      }
      const start = parseISO(b.start_time);
      const end = parseISO(b.end_time);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      return start <= dayEnd && end >= dayStart;
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col h-[600px]">
      <div className="p-6 border-b border-black/5 bg-gray-50 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-serif italic text-[#141414]">Conference Booking Calendar</h3>
          <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
            {format(new Date(), "MMMM yyyy")} • Facility Availability
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-mono uppercase text-black/40">Checked In</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-[10px] font-mono uppercase text-black/40">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className="text-[10px] font-mono uppercase text-black/40">Pending</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-white shadow-sm">
            <tr>
              <th className="p-4 bg-white border-r border-b border-black/5 text-[10px] font-mono uppercase text-black/40 min-w-[140px] sticky left-0 z-30">
                Facility
              </th>
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className={`p-2 border-b border-black/5 text-center min-w-[40px] ${
                    isSameDay(day, new Date()) ? "bg-black text-white" : "text-black/40"
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase">{format(day, "eee")}</div>
                  <div className="text-xs font-bold">{format(day, "dd")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((room) => (
                <tr key={room.id} className="group">
                  <td className="p-4 border-r border-b border-black/5 bg-white font-mono text-xs font-bold text-black/60 sticky left-0 z-10 group-hover:bg-gray-50">
                    {room.name}
                    <span className="block text-[8px] text-black/30 font-normal">
                      {room.capacity} pax
                    </span>
                  </td>
                  {days.map((day) => {
                    const dayBookings = getBookingsForRoomAndDay(room.id, day);

                    return (
                      <td
                        key={day.toISOString()}
                        className="p-0 border-b border-black/5 h-16 relative group-hover:bg-gray-50/50 align-top"
                      >
                        {dayBookings.length > 0 && (
                          <div className="absolute inset-0 flex flex-col gap-0.5 p-0.5 overflow-hidden">
                            {dayBookings.slice(0, 2).map((b, i) => (
                              <div
                                key={b.id}
                                className={`text-[7px] px-1 py-0.5 rounded-sm text-white font-bold truncate leading-tight ${
                                  b.status === "Checked In"
                                    ? "bg-emerald-500"
                                    : b.status === "Pending"
                                      ? "bg-yellow-400 text-yellow-900"
                                      : "bg-blue-500"
                                }`}
                                title={`${b.client_name} (${format(parseISO(b.start_time), "HH:mm")} - ${format(parseISO(b.end_time), "HH:mm")})`}
                              >
                                {b.client_name}
                              </div>
                            ))}
                            {dayBookings.length > 2 && (
                              <div className="text-[7px] text-black/40 font-bold px-1">
                                +{dayBookings.length - 2} more
                              </div>
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
