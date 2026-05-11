import type { Notification, User } from "../../../shared/types/hotel";
import { createNotificationRecord } from "../repositories/notificationsRepository";
import {
  sanitizeMultilineText,
  sanitizeText,
} from "../../../shared/validation/inputs";
import { STAFF_ROLES } from "../../../shared/security/roles";

type NotificationPayload = Omit<Notification, "id" | "read" | "created_at">;

/**
 * Validates and normalizes a notification before creation.
 */
function normalizeNotification(
  payload: NotificationPayload,
): NotificationPayload {
  return {
    ...payload,
    title: sanitizeText(payload.title, 80),
    message: sanitizeMultilineText(payload.message, 300),
  };
}

/**
 * Routes a notification to a specific user.
 */
export async function notifyUser(
  payload: NotificationPayload,
  options?: { showToast?: (msg: string, type?: "success" | "error") => void },
) {
  const normalized = normalizeNotification(payload);
  if (!normalized.userId) {
    console.warn("Notification skipped: userId target is required.");
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

/**
 * Routes a notification to all users with a specific staff role.
 */
export async function notifyRole(
  payload: NotificationPayload,
  options?: {
    mirrorToAdmin?: boolean;
    showToast?: (msg: string, type?: "success" | "error") => void;
  },
) {
  const normalized = normalizeNotification(payload);
  const targetRole = normalized.role as User["role"];

  if (!targetRole || !STAFF_ROLES.includes(targetRole)) {
    console.warn(
      `Notification skipped: Invalid or non-staff target role: ${targetRole}`,
    );
    return;
  }

  try {
    // 1. Send to target staff role
    await createNotificationRecord(normalized);

    // 2. Automatically mirror critical staff notifications to Admin for oversight
    if (options?.mirrorToAdmin !== false && targetRole !== "Admin") {
      await createNotificationRecord({
        ...normalized,
        role: "Admin",
      });
    }

    options?.showToast?.(`Notification routed to ${targetRole}`, "success");
  } catch (err) {
    options?.showToast?.(`Routing failure for ${targetRole}`, "error");
    throw err;
  }
}

/**
 * Top-level entry point for workflow notifications.
 */
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
  throw new Error("Invalid notification target: must specify userId or role.");
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
