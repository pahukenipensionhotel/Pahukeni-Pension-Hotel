import type { User } from "../types/hotel";
import { isStaffRole } from "./roles";

export function isAdmin(role?: User["role"] | null) {
  return role === "Admin";
}

export function canManageRooms(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist";
}

export function canManageLaundry(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist" || role === "Laundry man";
}

export function canManageConference(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist";
}

export function canManageStaff(role?: User["role"] | null) {
  return role === "Admin";
}

export function canManagePosMenu(
  type: "Restaurant" | "Bar",
  role?: User["role"] | null,
) {
  if (role === "Admin" || role === "System Developer") return true;
  if (type === "Bar" && (role === "Barman" || role === "Receptionist"))
    return true;
  if (type === "Restaurant" && role === "Receptionist") return true;
  return false;
}

export function canManageInventory(role?: User["role"] | null) {
  return role === "Admin" || role === "Barman" || role === "System Developer";
}

export function canReceiveOrderNotifications(
  type: "Restaurant" | "Bar",
  role?: User["role"] | null,
) {
  return (
    role === "Admin" ||
    (type === "Restaurant" && role === "Waiter") ||
    (type === "Bar" && role === "Barman")
  );
}

export function canReceiveFrontDeskNotifications(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist";
}

export function canAccessStaffArea(role?: User["role"] | null) {
  return isStaffRole(role);
}
