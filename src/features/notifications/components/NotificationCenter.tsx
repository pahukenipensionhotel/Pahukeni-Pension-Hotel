import { Bell, X } from "lucide-react";
import { motion } from "motion/react";
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
    <div className="w-full bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-black/5 flex items-center justify-between bg-gray-50/50">
        <h3 className="text-sm font-serif italic font-semibold text-gray-900">
          Notifications
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-black/5 rounded-full transition-colors active:scale-90"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell size={20} className="text-black/10" />
            </div>
            <p className="text-xs font-mono text-black/20 uppercase tracking-widest">
              Quiet for now
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {notifications.map((notif) => (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={notif.id}
                className={`p-5 transition-colors cursor-pointer hover:bg-gray-50/80 ${
                  !notif.read ? "bg-blue-50/40 relative" : ""
                }`}
                onClick={() => {
                  onMarkAsRead(notif.id);
                  onNavigate(notif.type, notif.title);
                  onClose();
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      notif.type === "order"
                        ? "bg-blue-50 text-blue-600"
                        : notif.type === "laundry"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    <Bell size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 mb-1 truncate">
                      {notif.title}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-2">
                      {notif.message}
                    </p>
                    <p className="text-[9px] font-mono text-gray-400 uppercase tracking-tight">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 ring-4 ring-blue-500/10" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
