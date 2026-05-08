import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import type { MenuItem } from "../../../shared/types/hotel";
import { mapFirestoreSnapshot } from "../../../shared/firestore/mappers";
import {
  requireText,
  sanitizeText,
} from "../../../shared/validation/inputs";

export interface MenuItemDraft {
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  type: MenuItem["type"];
  status: MenuItem["status"];
}

export function createEmptyMenuItemDraft(
  type: MenuItem["type"],
): MenuItemDraft {
  return {
    name: "",
    category: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    minStock: 5,
    type,
    status: "Available",
  };
}

function requireNonNegativeNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be zero or greater.`);
  }

  return Number(value);
}

function requireNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a whole number zero or greater.`);
  }

  return value;
}

function normalizeMenuItemDraft(input: MenuItemDraft) {
  const type = input.type;
  if (type !== "Restaurant" && type !== "Bar") {
    throw new Error("Menu type must be Restaurant or Bar.");
  }

  const stock = requireNonNegativeInteger(input.stock, "Stock");
  const minStock = requireNonNegativeInteger(input.minStock, "Minimum stock");
  const status =
    input.status === "Out of Stock" || (type === "Bar" && stock === 0)
      ? "Out of Stock"
      : "Available";

  return {
    name: requireText(input.name, "Name", 80),
    category: requireText(input.category, "Category", 60),
    price: requireNonNegativeNumber(input.price, "Price"),
    costPrice: requireNonNegativeNumber(input.costPrice, "Cost price"),
    stock,
    minStock,
    type,
    status,
  };
}

export async function createMenuItem(input: MenuItemDraft) {
  const payload = normalizeMenuItemDraft(input);
  await addDoc(collection(db, "menu_items"), payload);
}

export async function removeMenuItem(itemId: string) {
  await deleteDoc(doc(db, "menu_items", sanitizeText(itemId, 120)));
}

export async function updateMenuItemStatus(
  itemId: string,
  status: MenuItem["status"],
) {
  if (status !== "Available" && status !== "Out of Stock") {
    throw new Error("Status must be Available or Out of Stock.");
  }

  await updateDoc(doc(db, "menu_items", sanitizeText(itemId, 120)), { status });
}

export async function updateMenuItemInventory(
  itemId: string,
  stock: number,
  type: MenuItem["type"],
) {
  const normalizedStock = requireNonNegativeInteger(stock, "Stock");
  const status =
    type === "Bar" && normalizedStock === 0 ? "Out of Stock" : "Available";

  await updateDoc(doc(db, "menu_items", sanitizeText(itemId, 120)), {
    stock: normalizedStock,
    status,
  });
}

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
