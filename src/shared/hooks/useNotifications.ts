import { create } from "zustand";

export type NotificationType = "success" | "error" | "info" | "warning";
export type NotificationLayout = "toast" | "modal" | "inline";

export interface Notification {
  id: string;
  type: NotificationType;
  layout: NotificationLayout;
  title?: string;
  message: string;
  duration?: number; // ms
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));
    return id;
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
