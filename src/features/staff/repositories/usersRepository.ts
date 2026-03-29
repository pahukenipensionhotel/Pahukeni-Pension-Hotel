import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type { User } from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";

export async function fetchUserProfile(uid: string, email?: string | null) {
  let userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists() && email) {
    userDoc = await getDoc(doc(db, "users", email));
  }
  return userDoc;
}

export async function saveUserProfile(uid: string, data: Omit<User, "id">) {
  await setDoc(doc(db, "users", uid), data);
}

export function subscribeUsers(
  onData: (users: User[]) => void,
  onError?: (error: unknown) => void,
) {
  return onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      onData(mapFirestoreSnapshot<User>(snapshot));
    },
    onError,
  );
}
