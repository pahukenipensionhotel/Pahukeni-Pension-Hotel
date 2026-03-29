export const STAFF_TABS = [
  "dashboard",
  "rooms",
  "restaurant",
  "bar",
  "laundry",
  "conference",
  "reports",
  "staff",
] as const;

export const PORTAL_TABS = [
  "home",
  "rooms",
  "dining",
  "orders",
  "laundry",
  "conference",
] as const;

export type StaffTab = (typeof STAFF_TABS)[number];
export type PortalTab = (typeof PORTAL_TABS)[number];

export function getHashTab<T extends string>(
  scope: "staff" | "portal",
  validTabs: readonly T[],
  fallback: T,
) {
  if (typeof window === "undefined") return fallback;

  const [hashScope, hashTab] = window.location.hash.replace(/^#\/?/, "").split("/");
  return hashScope === scope && validTabs.includes(hashTab as T)
    ? (hashTab as T)
    : fallback;
}

export function syncHashTab(scope: "staff" | "portal", tab: string) {
  if (typeof window === "undefined") return;

  const nextHash = `#/${scope}/${tab}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}
