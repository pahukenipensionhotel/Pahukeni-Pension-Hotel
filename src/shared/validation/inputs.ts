import { auth } from "../../services/firebase/client";

const MAX_TEXT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 500;

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function sanitizeText(value: string, maxLength = MAX_TEXT_LENGTH) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeMultilineText(
  value: string,
  maxLength = MAX_MESSAGE_LENGTH,
) {
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export function requireText(
  value: string,
  fieldName: string,
  maxLength = MAX_TEXT_LENGTH,
) {
  const sanitized = sanitizeText(value, maxLength);
  if (!sanitized) {
    throw new Error(`${fieldName} is required.`);
  }
  return sanitized;
}

export function requirePositiveNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
  return value;
}

export function validateEmailAddress(value: string) {
  const sanitized = sanitizeText(value, 120).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(sanitized)) {
    throw new Error("A valid email address is required.");
  }
  return sanitized;
}

export function parseNumberInput(val: string) {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
