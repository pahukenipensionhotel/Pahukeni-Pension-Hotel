import { Bell, X } from "lucide-react";
import type { Notification } from "../types";

export function NotificationCenter({
  notifications,
  onClose,
  onMarkAsRead,
  onNavigate,
}: {
  notifications: Notification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onNavigate: (type: string, title: string) => void;
}) {
  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-black/5 z-[100] overflow-hidden">
      <div className="p-4 border-bottom border-black/5 flex items-center justify-between bg-gray-50">
        <h3 className="text-sm font-serif italic">Notifications</h3>
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-black/20 font-mono text-xs">No notifications</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 border-bottom border-black/5 last:border-0 transition-colors cursor-pointer hover:bg-gray-50 ${!notif.read ? "bg-blue-50/30" : ""}`}
              onClick={() => {
                onMarkAsRead(notif.id);
                onNavigate(notif.type, notif.title);
                onClose();
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    notif.type === "order"
                      ? "bg-blue-100 text-blue-600"
                      : notif.type === "laundry"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Bell size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium mb-1">{notif.title}</p>
                  <p className="text-[10px] text-black/60 leading-relaxed mb-2">{notif.message}</p>
                  <p className="text-[8px] font-mono text-black/30 uppercase">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
                {!notif.read && <div className="w-2 h-2 bg-blue-600 rounded-full mt-1" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
