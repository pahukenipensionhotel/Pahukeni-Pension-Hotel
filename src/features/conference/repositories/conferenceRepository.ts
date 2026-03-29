import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type {
  ConferenceRoom,
  ConferenceService,
} from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";

export function subscribeConferenceRooms(
  onData: (rooms: ConferenceRoom[]) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    collection(db, "conference_rooms"),
    (snapshot) => {
      onData(mapFirestoreSnapshot<ConferenceRoom>(snapshot));
    },
    onError,
  );
}

export function subscribeConferenceServices(
  onData: (services: ConferenceService[]) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    collection(db, "conference_services"),
    (snapshot) => {
      onData(mapFirestoreSnapshot<ConferenceService>(snapshot));
    },
    onError,
  );
}

export function subscribeConferenceBookings(
  userId: string,
  isStaff: boolean,
  onData: (bookings: any[]) => void,
  onError?: (error: unknown) => void,
) {
  const bookingsQuery = isStaff
    ? collection(db, "conference_bookings")
    : query(
        collection(db, "conference_bookings"),
        where("client_uid", "==", userId),
      );

  return onSnapshot(
    bookingsQuery,
    (snapshot) => {
      onData(mapFirestoreSnapshot<any>(snapshot));
    },
    onError,
  );
}
