import type { Notification, User } from "../../../shared/types/hotel";
import { createNotificationRecord } from "../repositories/notificationsRepository";
import {
  sanitizeMultilineText,
  sanitizeText,
} from "../../../shared/validation/inputs";

type NotificationPayload = Omit<Notification, "id" | "read" | "created_at">;

function normalizeNotification(
  payload: NotificationPayload,
): NotificationPayload {
  return {
    ...payload,
    title: sanitizeText(payload.title, 80),
    message: sanitizeMultilineText(payload.message, 300),
  };
}

export async function notifyUser(
  payload: NotificationPayload,
  options?: { showToast?: (msg: string, type?: "success" | "error") => void },
) {
  const normalized = normalizeNotification(payload);
  if (!normalized.userId) {
    // If no userId, we can't send a targeted notification, but we might want to log it
    console.warn(
      "Notification skipped: No userId provided for targeted notification",
      normalized,
    );
    return;
  }
  try {
    await createNotificationRecord(normalized);
    options?.showToast?.(`Notification sent to user`, "success");
  } catch (err) {
    options?.showToast?.(`Failed to send notification`, "error");
    throw err;
  }
}

export async function notifyRole(
  payload: NotificationPayload,
  options?: {
    mirrorToAdmin?: boolean;
    showToast?: (msg: string, type?: "success" | "error") => void;
  },
) {
  const normalized = normalizeNotification(payload);
  if (!normalized.role) {
    throw new Error("Notification role target is required.");
  }

  try {
    await createNotificationRecord(normalized);

    if (options?.mirrorToAdmin !== false && normalized.role !== "Admin") {
      await createNotificationRecord({
        ...normalized,
        role: "Admin",
      });
    }
    options?.showToast?.(`Notification sent to ${normalized.role}`, "success");
  } catch (err) {
    options?.showToast?.(`Failed to notify ${normalized.role}`, "error");
    throw err;
  }
}

export async function createWorkflowNotification(
  payload: NotificationPayload,
  options?: {
    mirrorToAdmin?: boolean;
    showToast?: (msg: string, type?: "success" | "error") => void;
  },
) {
  if (payload.userId) {
    return notifyUser(payload, options);
  }
  if (payload.role) {
    return notifyRole(payload, options);
  }
  throw new Error("Notification target is required.");
}

export function buildOrderStatusMessage(
  type: "Restaurant" | "Bar",
  status: string,
  estimatedArrival?: string,
) {
  return `Your ${type} order status is now: ${status}${estimatedArrival ? `. Est. arrival: ${estimatedArrival}` : ""}`;
}

export function buildLaundryStatusMessage(
  status: string,
  estimatedArrival?: string,
) {
  return `Your laundry order is now: ${status}${estimatedArrival ? `. Est. delivery: ${estimatedArrival}` : ""}`;
}

export function buildCustomerOrderNotification(
  user: User,
  itemName: string,
  type: "Restaurant" | "Bar",
) {
  return {
    role: type === "Restaurant" ? "Waiter" : "Barman",
    title: `New ${type} Order`,
    message: `New order from ${user.name} for ${itemName}`,
    type: "order" as const,
  };
}
