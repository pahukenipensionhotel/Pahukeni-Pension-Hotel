import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase";
import {
  ScrollText,
  Clock,
  User,
  Tag,
  AlertCircle,
  Download,
} from "lucide-react";
import { motion } from "motion/react";

interface LogEntry {
  id: string;
  level: "INFO" | "WARN" | "ERROR" | "SECURITY";
  category: string;
  action: string;
  message: string;
  userName?: string;
  timestamp: any;
  details?: any;
}

export const SystemLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "system_logs"),
      orderBy("timestamp", "desc"),
      limit(100),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LogEntry[];
      setLogs(newLogs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const downloadCSV = () => {
    const headers = [
      "Timestamp",
      "Level",
      "Category",
      "Action",
      "User",
      "Message",
    ];
    const csvContent = [
      headers.join(","),
      ...logs.map((log) =>
        [
          log.timestamp?.toDate ? log.timestamp.toDate().toISOString() : "N/A",
          log.level,
          log.category,
          `"${log.action.replace(/"/g, '""')}"`,
          `"${(log.userName || "System").replace(/"/g, '""')}"`,
          `"${log.message.replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `system_logs_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "ERROR":
        return "text-red-600 bg-red-50 border-red-100";
      case "WARN":
        return "text-orange-600 bg-orange-50 border-orange-100";
      case "SECURITY":
        return "text-purple-600 bg-purple-50 border-purple-100";
      default:
        return "text-blue-600 bg-blue-50 border-blue-100";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-8 h-8 border-4 border-black/10 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-black text-white p-8 rounded-3xl flex items-center justify-between overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-3xl font-serif italic mb-2">System Audit Logs</h2>
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em]">
              Real-time Immutable Activity Stream
            </p>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-mono uppercase transition-colors border border-white/10"
            >
              <Download size={12} /> Download CSV
            </button>
          </div>
        </div>
        <ScrollText
          size={120}
          className="absolute -right-4 -bottom-4 text-white/5 rotate-12"
        />
      </div>

      <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F9F9F8] border-b border-black/5">
              <tr>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Timestamp
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Level
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Event
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  User
                </th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {logs.map((log) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="p-6 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-black/40">
                      <Clock size={12} />
                      {log.timestamp?.toDate
                        ? log.timestamp.toDate().toLocaleString()
                        : "Just now"}
                    </div>
                  </td>
                  <td className="p-6">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[8px] font-mono uppercase border ${getLevelColor(log.level)}`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold font-mono text-black/80">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-black/40 font-mono uppercase tracking-tighter">
                        {log.category}
                      </span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center">
                        <User size={10} className="text-black/40" />
                      </div>
                      <span className="text-xs font-medium">
                        {log.userName || "System"}
                      </span>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="text-xs text-black/60 max-w-md line-clamp-1 italic">
                      {log.message}
                    </p>
                  </td>
                </motion.tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-12 text-center text-black/20 font-mono text-sm italic"
                  >
                    No system logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
