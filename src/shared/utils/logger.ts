import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from "firebase/firestore";
import { db } from "../../firebase";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "SECURITY";

export interface SystemLog {
  timestamp: Timestamp | FieldValue;
  level: LogLevel;
  action: string;
  category: "AUTH" | "BOOKING" | "ORDER" | "LAUNDRY" | "STAFF" | "SYSTEM";
  message: string;
  userId?: string;
  userName?: string;
  details?: Record<string, unknown>;
}

class SystemLogger {
  private static instance: SystemLogger;

  private constructor() {}

  public static getInstance(): SystemLogger {
    if (!SystemLogger.instance) {
      SystemLogger.instance = new SystemLogger();
    }
    return SystemLogger.instance;
  }

  async log(params: Omit<SystemLog, "timestamp">) {
    try {
      // Filter out undefined values to prevent Firestore errors
      const logData = Object.fromEntries(
        Object.entries(params).filter(([_, value]) => value !== undefined),
      );

      await addDoc(collection(db, "system_logs"), {
        ...logData,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      // Fail silently in production or handle fallback
      console.error("Critical: Failed to write system log", err);
    }
  }

  // Helper methods for semantic logging
  async info(
    category: SystemLog["category"],
    action: string,
    message: string,
    userId?: string,
    userName?: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      level: "INFO",
      category,
      action,
      message,
      userId,
      userName,
      details,
    });
  }

  async warn(
    category: SystemLog["category"],
    action: string,
    message: string,
    userId?: string,
    userName?: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      level: "WARN",
      category,
      action,
      message,
      userId,
      userName,
      details,
    });
  }

  async error(
    category: SystemLog["category"],
    action: string,
    message: string,
    userId?: string,
    userName?: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      level: "ERROR",
      category,
      action,
      message,
      userId,
      userName,
      details,
    });
  }

  async security(
    action: string,
    message: string,
    userId?: string,
    userName?: string,
    details?: Record<string, unknown>,
  ) {
    return this.log({
      level: "SECURITY",
      category: "AUTH",
      action,
      message,
      userId,
      userName,
      details,
    });
  }
}

export const logger = SystemLogger.getInstance();
