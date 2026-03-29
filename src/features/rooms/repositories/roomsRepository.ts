import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type { Room } from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";

export function subscribeRooms(
  onData: (rooms: Room[]) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    collection(db, "rooms"),
    (snapshot) => {
      onData(mapFirestoreSnapshot<Room>(snapshot));
    },
    onError,
  );
}
