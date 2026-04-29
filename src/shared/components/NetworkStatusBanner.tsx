import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[120] flex justify-center px-4 py-3 pointer-events-none">
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 shadow-lg pointer-events-auto">
        <WifiOff size={16} />
        <span>
          You are offline. Live Firestore data and reports will update when the
          connection returns.
        </span>
      </div>
    </div>
  );
}
