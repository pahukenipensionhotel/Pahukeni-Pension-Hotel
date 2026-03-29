import type { Notification, User } from "../../../shared/types/hotel";
import { createNotificationRecord } from "../repositories/notificationsRepository";
import { sanitizeMultilineText, sanitizeText } from "../../../shared/validation/inputs";

type NotificationPayload = Omit<Notification, "id" | "read" | "created_at">;

function normalizeNotification(payload: NotificationPayload): NotificationPayload {
  return {
    ...payload,
    title: sanitizeText(payload.title, 80),
    message: sanitizeMultilineText(payload.message, 300),
  };
}

export async function notifyUser(payload: NotificationPayload) {
  const normalized = normalizeNotification(payload);
  if (!normalized.userId) {
    throw new Error("Notification user target is required.");
  }
  await createNotificationRecord(normalized);
}

export async function notifyRole(payload: NotificationPayload, options?: { mirrorToAdmin?: boolean }) {
  const normalized = normalizeNotification(payload);
  if (!normalized.role) {
    throw new Error("Notification role target is required.");
  }

  await createNotificationRecord(normalized);

  if (options?.mirrorToAdmin !== false && normalized.role !== "Admin") {
    await createNotificationRecord({
      ...normalized,
      role: "Admin",
    });
  }
}

export async function createWorkflowNotification(payload: NotificationPayload) {
  if (payload.userId) {
    return notifyUser(payload);
  }
  if (payload.role) {
    return notifyRole(payload);
  }
  throw new Error("Notification target is required.");
}

export function buildOrderStatusMessage(type: "Restaurant" | "Bar", status: string, estimatedArrival?: string) {
  return `Your ${type} order status is now: ${status}${estimatedArrival ? `. Est. arrival: ${estimatedArrival}` : ""}`;
}

export function buildLaundryStatusMessage(status: string, estimatedArrival?: string) {
  return `Your laundry order is now: ${status}${estimatedArrival ? `. Est. delivery: ${estimatedArrival}` : ""}`;
}

export function buildCustomerOrderNotification(user: User, itemName: string, type: "Restaurant" | "Bar") {
  return {
    role: type === "Restaurant" ? "Waiter" : "Barman",
    title: `New ${type} Order`,
    message: `New order from ${user.name} for ${itemName}`,
    type: "order" as const,
  };
}
