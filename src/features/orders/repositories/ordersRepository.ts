import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type { Order } from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";

export function subscribeOrders(
  userId: string,
  isStaff: boolean,
  onData: (orders: Order[]) => void,
  onError?: (error: unknown) => void,
) {
  const ordersQuery = isStaff
    ? collection(db, "orders")
    : query(collection(db, "orders"), where("customer_uid", "==", userId));

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      onData(mapFirestoreSnapshot<Order>(snapshot));
    },
    onError,
  );
}
