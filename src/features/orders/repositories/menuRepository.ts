import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type { MenuItem } from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";

export function subscribeMenuItems(
  onData: (items: MenuItem[]) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    collection(db, "menu_items"),
    (snapshot) => {
      onData(mapFirestoreSnapshot<MenuItem>(snapshot));
    },
    onError,
  );
}
