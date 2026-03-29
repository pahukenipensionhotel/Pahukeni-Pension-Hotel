import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from "firebase/firestore";

export function mapFirestoreDoc<T>(entry: QueryDocumentSnapshot<DocumentData>) {
  return { id: entry.id, ...entry.data() } as T;
}

export function mapFirestoreSnapshot<T>(snapshot: QuerySnapshot<DocumentData>) {
  return snapshot.docs.map((entry) => mapFirestoreDoc<T>(entry));
}
