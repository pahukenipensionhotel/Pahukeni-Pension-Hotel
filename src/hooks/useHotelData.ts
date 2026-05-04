import { useState, useEffect, useRef, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { resolveUserProfile } from "../features/auth/services/resolveUserProfile";
import {
  Room,
  MenuItem,
  Order,
  LaundryOrder,
  User,
  Notification as HotelNotification,
  Folio,
  HotelExpenditure,
} from "../shared/types/hotel";
import { isStaffRole } from "../shared/security/roles";
import {
  canManageRooms,
  canManagePosMenu,
  canManageStaff,
  canReceiveOrderNotifications,
  canReceiveFrontDeskNotifications,
} from "../shared/security/authorization";
import {
  handleFirestoreError,
  OperationType,
} from "../shared/validation/inputs";
import { NotificationService } from "../services/notificationService";
import {
  getDefaultRoomImage,
  getDefaultMenuImage,
} from "../shared/assets/imageCatalog";
import { createWorkflowNotification } from "../features/notifications/services/notificationWorkflow";
import { markNotificationRead } from "../features/notifications/repositories/notificationsRepository";

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function useHotelData(
  showToast: (msg: string, type: "success" | "error" | "info") => void,
) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [laundry, setLaundry] = useState<LaundryOrder[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [conferenceRooms, setConferenceRooms] = useState<any[]>([]);
  const [laundryServices, setLaundryServices] = useState<any[]>([]);
  const [conferenceServices, setConferenceServices] = useState<any[]>([]);
  const [conferenceBookings, setConferenceBookings] = useState<any[]>([]);
  const [globalPreferences, setGlobalPreferences] = useState<any[]>([]);
  const [folios, setFolios] = useState<Folio[]>([]);
  const [expenditures, setExpenditures] = useState<HotelExpenditure[]>([]);
  const [notifications, setHotelNotifications] = useState<HotelNotification[]>(
    [],
  );

  const lastOrdersCount = useRef<number | null>(null);
  const lastLaundryCount = useRef<number | null>(null);
  const lastBookingCount = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setUser(await resolveUserProfile(firebaseUser));
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const isStaff = isStaffRole(user?.role);

  useEffect(() => {
    if (!user) return;

    const unsubRooms = onSnapshot(
      collection(db, "rooms"),
      (snapshot) => {
        setRooms(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Room),
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, "rooms"),
    );

    const unsubMenu = onSnapshot(
      collection(db, "menu_items"),
      (snapshot) => {
        setMenu(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as MenuItem,
          ),
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, "menu_items"),
    );

    const ordersQuery = isStaff
      ? collection(db, "orders")
      : query(collection(db, "orders"), where("customer_uid", "==", user.id));

    const unsubOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const newOrders = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Order,
        );
        setOrders(newOrders);

        if (
          lastOrdersCount.current !== null &&
          newOrders.length > lastOrdersCount.current
        ) {
          const latest = [...newOrders].sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )[0];
          if (latest && latest.status === "Pending") {
            if (canReceiveOrderNotifications(latest.type, user.role)) {
              showToast(`New ${latest.type} Order Received!`, "info");
              NotificationService.notify(`New ${latest.type} Order`, {
                body: `Table ${latest.table_number || "N/A"} placed an order for N$ ${latest.total_price}`,
                icon: "/assets/images/logo/pahukeni_logo.png",
              });
            }
          }
        }
        lastOrdersCount.current = newOrders.length;
      },
      (error) => handleFirestoreError(error, OperationType.GET, "orders"),
    );

    const laundryQuery = isStaff
      ? collection(db, "laundry_orders")
      : query(
          collection(db, "laundry_orders"),
          where("customer_uid", "==", user.id),
        );

    const unsubLaundry = onSnapshot(
      laundryQuery,
      (snapshot) => {
        const newLaundry = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as LaundryOrder,
        );
        setLaundry(newLaundry);

        if (
          lastLaundryCount.current !== null &&
          newLaundry.length > lastLaundryCount.current
        ) {
          if (canReceiveFrontDeskNotifications(user.role)) {
            NotificationService.notify("New Laundry Request", {
              body: "A new laundry service request has been received.",
              tag: "new-laundry",
            });
          }
        }
        lastLaundryCount.current = newLaundry.length;
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "laundry_orders"),
    );

    const unsubBookings = onSnapshot(
      collection(db, "room_bookings"),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "room_bookings"),
    );

    const unsubFolios = onSnapshot(
      collection(db, "folios"),
      (snapshot) => {
        setFolios(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Folio),
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, "folios"),
    );

    const unsubExpenditures = onSnapshot(
      collection(db, "expenditures"),
      (snapshot) => {
        setExpenditures(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as HotelExpenditure,
          ),
        );
      },
      (error) => handleFirestoreError(error, OperationType.GET, "expenditures"),
    );

    let unsubUsers = () => {};
    if (canManageStaff(user.role)) {
      unsubUsers = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          setUsers(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User),
          );
        },
        (error) => handleFirestoreError(error, OperationType.GET, "users"),
      );
    }

    const unsubConf = onSnapshot(
      collection(db, "conference_rooms"),
      (snapshot) => {
        setConferenceRooms(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "conference_rooms"),
    );

    const unsubLaundryServices = onSnapshot(
      collection(db, "laundry_services"),
      (snapshot) => {
        setLaundryServices(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "laundry_services"),
    );

    const unsubConfServices = onSnapshot(
      collection(db, "conference_services"),
      (snapshot) => {
        setConferenceServices(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "conference_services"),
    );

    const confBookingsQuery = isStaff
      ? collection(db, "conference_bookings")
      : query(
          collection(db, "conference_bookings"),
          where("client_uid", "==", user.id),
        );

    const unsubConfBookings = onSnapshot(
      confBookingsQuery,
      (snapshot) => {
        const newBookings = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setConferenceBookings(newBookings);
        if (
          lastBookingCount.current !== null &&
          newBookings.length > lastBookingCount.current
        ) {
          if (canReceiveFrontDeskNotifications(user.role)) {
            NotificationService.notify("New Conference Booking", {
              body: "A new conference room booking request has been received.",
              tag: "new-conference",
            });
          }
        }
        lastBookingCount.current = newBookings.length;
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "conference_bookings"),
    );

    const unsubNotifs = onSnapshot(
      query(
        collection(db, "notifications"),
        where("userId", "==", user.id),
        orderBy("created_at", "desc"),
      ),
      (snapshot) => {
        const personalNotifs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as HotelNotification,
        );
        setHotelNotifications((prev) => {
          const unique = dedupeById([...prev, ...personalNotifs]);
          personalNotifs
            .filter((n) => !n.read)
            .forEach((n) => {
              if (Date.now() - new Date(n.created_at).getTime() < 10000) {
                NotificationService.notify(n.title, {
                  body: n.message,
                  tag: n.id,
                });
              }
            });
          return unique.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
        });
      },
    );

    const unsubRoleNotifs = onSnapshot(
      query(
        collection(db, "notifications"),
        where("role", "==", user.role),
        orderBy("created_at", "desc"),
      ),
      (snapshot) => {
        const roleNotifs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as HotelNotification,
        );
        setHotelNotifications((prev) => {
          const unique = dedupeById([...prev, ...roleNotifs]);
          roleNotifs
            .filter((n) => !n.read)
            .forEach((n) => {
              if (Date.now() - new Date(n.created_at).getTime() < 10000) {
                NotificationService.notify(n.title, {
                  body: n.message,
                  tag: n.id,
                });
              }
            });
          return unique.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
        });
      },
    );

    const unsubPrefs = onSnapshot(
      collection(db, "global_preferences"),
      (snapshot) => {
        setGlobalPreferences(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, "global_preferences"),
    );

    return () => {
      unsubRooms();
      unsubMenu();
      unsubOrders();
      unsubLaundry();
      unsubBookings();
      unsubExpenditures();
      unsubUsers();
      unsubConf();
      unsubLaundryServices();
      unsubConfServices();
      unsubConfBookings();
      unsubNotifs();
      unsubRoleNotifs();
      unsubPrefs();
    };
  }, [user]);

  useEffect(() => {
    if (authReady && user && rooms.length > 0) {
      const migrateImages = async () => {
        if (!canManageRooms(user.role)) return;
        const roomsToUpdate = rooms.filter(
          (r) =>
            !r.imageUrl ||
            r.imageUrl.includes(" ") ||
            r.imageUrl.includes("single room") ||
            r.imageUrl.includes("double room") ||
            r.imageUrl.startsWith("https://images.pexels.com") ||
            r.imageUrl.includes("picsum.photos") ||
            r.imageUrl.startsWith("/rooms/"),
        );
        for (const room of roomsToUpdate) {
          const newUrl = getDefaultRoomImage(room);
          if (newUrl !== room.imageUrl)
            await updateDoc(doc(db, "rooms", room.id), { imageUrl: newUrl });
        }
        const menuItemsToUpdate = menu.filter(
          (item) =>
            !item.imageUrl ||
            item.imageUrl.includes("picsum.photos") ||
            item.imageUrl.includes("pexels.com") ||
            item.imageUrl.endsWith(".svg") ||
            item.imageUrl !== getDefaultMenuImage(item),
        );
        for (const item of menuItemsToUpdate) {
          if (!canManagePosMenu(item.type, user.role)) continue;
          // Skip legacy/incomplete docs that would fail firestore rule validation on update.
          if (
            !item.name ||
            typeof item.category !== "string" ||
            (item.type !== "Restaurant" && item.type !== "Bar") ||
            (item.status !== "Available" && item.status !== "Out of Stock") ||
            typeof item.price !== "number"
          ) {
            continue;
          }
          const newUrl = getDefaultMenuImage(item);
          if (newUrl !== item.imageUrl) {
            await updateDoc(doc(db, "menu_items", item.id), {
              imageUrl: newUrl,
            });
          }
        }
      };
      migrateImages().catch((err) => {
        console.warn("Skipping menu image migration due to permissions.", err);
      });
    }
  }, [authReady, menu, rooms, user]);

  const stats = useMemo(
    () => ({
      activeGuests: bookings.filter((b) => b.status === "Active").length,
      availableRooms: rooms.filter((r) => r.status === "Available").length,
      pendingLaundry: laundry.filter((l) => l.status !== "Delivered").length,
      totalRevenue: [...bookings, ...orders, ...laundry].reduce(
        (sum, item) => sum + (item.total_price || 0),
        0,
      ),
    }),
    [rooms, laundry, bookings, orders],
  );

  const createNotification = async (
    notif: Omit<HotelNotification, "id" | "read" | "created_at">,
  ) => {
    try {
      await createWorkflowNotification(notif, {
        showToast: (msg, type) => showToast(msg, type || "info"),
      });
    } catch (err) {
      console.error(err);
      showToast("Failed to send notification", "error");
    }
  };

  const markHotelNotificationAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "notifications");
    }
  };

  return {
    user,
    authReady,
    rooms,
    menu,
    orders,
    laundry,
    bookings,
    users,
    conferenceRooms,
    laundryServices,
    conferenceServices,
    conferenceBookings,
    globalPreferences,
    folios,
    expenditures,
    notifications,
    stats,
    createNotification,
    markHotelNotificationAsRead,
  };
}
