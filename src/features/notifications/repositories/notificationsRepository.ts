import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type { Notification } from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";

export function subscribeUserNotifications(
  userId: string,
  onData: (notifications: Notification[]) => void,
  onError?: (error: unknown) => void,
) {
  const notificationsQuery = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("created_at", "desc"),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      onData(mapFirestoreSnapshot<Notification>(snapshot));
    },
    onError,
  );
}

export function subscribeRoleNotifications(
  role: string,
  onData: (notifications: Notification[]) => void,
  onError?: (error: unknown) => void,
) {
  const notificationsQuery = query(
    collection(db, "notifications"),
    where("role", "==", role),
    orderBy("created_at", "desc"),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      onData(mapFirestoreSnapshot<Notification>(snapshot));
    },
    onError,
  );
}

export async function createNotificationRecord(
  notification: Omit<Notification, "id" | "read" | "created_at">,
) {
  await addDoc(collection(db, "notifications"), {
    ...notification,
    read: false,
    created_at: new Date().toISOString(),
  });
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}
