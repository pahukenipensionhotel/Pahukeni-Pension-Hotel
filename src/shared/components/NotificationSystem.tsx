import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";
import {
  useNotificationStore,
  Notification,
  NotificationType,
} from "../hooks/useNotifications";

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

const colors = {
  success: "bg-green-50 border-green-100",
  error: "bg-red-50 border-red-100",
  warning: "bg-amber-50 border-amber-100",
  info: "bg-blue-50 border-blue-100",
};

export const NotificationSystem: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore();

  const toasts = notifications.filter((n) => n.layout === "toast");
  const modals = notifications.filter((n) => n.layout === "modal");

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((notification) => (
            <ToastItem
              key={notification.id}
              notification={notification}
              onClose={() => removeNotification(notification.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modals.map((notification) => (
          <ModalItem
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </AnimatePresence>
    </>
  );
};

const ToastItem: React.FC<{
  notification: Notification;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  React.useEffect(() => {
    if (notification.duration !== Infinity) {
      const timer = setTimeout(onClose, notification.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-xl border shadow-lg ${colors[notification.type]} flex items-start gap-3`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[notification.type]}</div>
      <div className="flex-1">
        {notification.title && (
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {notification.title}
          </h3>
        )}
        <p className="text-sm text-gray-700 leading-relaxed font-mono">
          {notification.message}
        </p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </motion.div>
  );
};

const ModalItem: React.FC<{
  notification: Notification;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/5"
      >
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div
              className={`p-3 rounded-xl ${colors[notification.type].split(" ")[0]}`}
            >
              {icons[notification.type]}
            </div>
            {notification.title && (
              <h2 className="text-xl font-serif italic text-gray-900">
                {notification.title}
              </h2>
            )}
          </div>
          <p className="text-gray-600 leading-relaxed font-mono text-sm mb-8">
            {notification.message}
          </p>
          <div className="flex flex-col gap-3">
            {notification.onConfirm && (
              <button
                onClick={() => {
                  notification.onConfirm?.();
                  onClose();
                }}
                className="w-full py-3 bg-[#141414] text-white rounded-xl font-medium hover:bg-black transition-colors"
              >
                Confirm
              </button>
            )}
            <button
              onClick={() => {
                notification.onCancel?.();
                onClose();
              }}
              className="w-full py-3 bg-gray-100 text-gray-900 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              {notification.onConfirm ? "Cancel" : "Close"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const InlineNotification: React.FC<{
  type: NotificationType;
  message: string;
  className?: string;
}> = ({ type, message, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={`p-3 rounded-xl border flex items-start gap-3 overflow-hidden ${colors[type]} ${className}`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <p className="text-xs font-mono leading-relaxed text-gray-700">
        {message}
      </p>
    </motion.div>
  );
};
