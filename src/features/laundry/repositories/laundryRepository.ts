import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type { LaundryOrder, LaundryService } from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";

export function subscribeLaundryOrders(
  userId: string,
  isStaff: boolean,
  onData: (orders: LaundryOrder[]) => void,
  onError?: (error: unknown) => void,
) {
  const laundryQuery = isStaff
    ? collection(db, "laundry_orders")
    : query(
        collection(db, "laundry_orders"),
        where("customer_uid", "==", userId),
      );

  return onSnapshot(
    laundryQuery,
    (snapshot) => {
      onData(mapFirestoreSnapshot<LaundryOrder>(snapshot));
    },
    onError,
  );
}

export function subscribeLaundryServices(
  onData: (services: LaundryService[]) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    collection(db, "laundry_services"),
    (snapshot) => {
      onData(mapFirestoreSnapshot<LaundryService>(snapshot));
    },
    onError,
  );
}
