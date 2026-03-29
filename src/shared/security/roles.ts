import type { User } from "../types/hotel";

export const STAFF_ROLES: User["role"][] = [
  "Admin",
  "Receptionist",
  "Waiter",
  "Barman",
  "Laundry",
];

export function isStaffRole(role?: User["role"] | null): role is Exclude<User["role"], "Customer"> {
  return !!role && STAFF_ROLES.includes(role);
}
