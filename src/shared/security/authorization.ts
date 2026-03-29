import type { User } from "../types/hotel";
import { isStaffRole } from "./roles";

export function isAdmin(role?: User["role"] | null) {
  return role === "Admin";
}

export function canManageRooms(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist";
}

export function canManageLaundry(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist" || role === "Laundry";
}

export function canManageConference(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist";
}

export function canManageStaff(role?: User["role"] | null) {
  return role === "Admin";
}

export function canManagePosMenu(type: "Restaurant" | "Bar", role?: User["role"] | null) {
  return (
    role === "Admin" ||
    (type === "Restaurant" && role === "Waiter") ||
    (type === "Bar" && role === "Barman")
  );
}

export function canManageInventory(role?: User["role"] | null) {
  return role === "Admin" || role === "Barman";
}

export function canReceiveOrderNotifications(type: "Restaurant" | "Bar", role?: User["role"] | null) {
  return role === "Admin" || (type === "Restaurant" && role === "Waiter") || (type === "Bar" && role === "Barman");
}

export function canReceiveFrontDeskNotifications(role?: User["role"] | null) {
  return role === "Admin" || role === "Receptionist";
}

export function canAccessStaffArea(role?: User["role"] | null) {
  return isStaffRole(role);
}
