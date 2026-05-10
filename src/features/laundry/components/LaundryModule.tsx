import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Printer, X } from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import {
  LaundryOrder,
  LaundryService,
  Notification,
  User,
} from "../../../shared/types/hotel";
import { canManageLaundry } from "../../../shared/security/authorization";
import {
  handleFirestoreError,
  OperationType,
  sanitizeText,
  parseNumberInput,
} from "../../../shared/validation/inputs";
import {
  notifyRole,
  notifyUser,
  buildLaundryStatusMessage,
} from "../../notifications/services/notificationWorkflow";
import { logger } from "../../../shared/utils/logger";
import { auth } from "../../../services/firebase/client";

export const LaundryModule = ({
  orders,
  services,
  isAdmin,
  userRole,
  user,
  createNotification,
}: {
  orders: LaundryOrder[];
  services: LaundryService[];
  isAdmin: boolean;
  userRole?: string;
  user: User;
  createNotification: (
    notif: Omit<Notification, "id" | "read" | "created_at">,
  ) => Promise<void>;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string>("orders");

  const canManage = canManageLaundry(userRole as User["role"] | undefined);
  const [newOrder, setNewOrder] = useState<
    Omit<LaundryOrder, "id" | "items" | "created_at">
  >({
    room_number: "",
    guest_name: "",
    total_price: 0,
    status: "Received",
  });
  const [newService, setNewService] = useState<Omit<LaundryService, "id">>({
    name: "",
    price: 0,
  });
  const [cart, setCart] = useState<{ item: LaundryService; qty: number }[]>([]);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const total = cart.reduce((sum, i) => sum + i.item.price * i.qty, 0);

  const addToCart = (item: LaundryService) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing)
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...prev, { item, qty: 1 }];
    });
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "laundry_orders"), {
        room_number: newOrder.room_number,
        guest_name: newOrder.guest_name,
        total_price: total,
        status: "Received",
        items: cart.map((c) => ({
          name: c.item.name,
          price: c.item.price,
          qty: c.qty,
        })),
        created_at: new Date().toISOString(),
      });

      await logger.info(
        "LAUNDRY",
        "PLACE_ORDER",
        `New laundry order for ${newOrder.guest_name}`,
        auth.currentUser?.uid,
        auth.currentUser?.displayName || undefined,
        { room: newOrder.room_number, total },
      );

      // Notify staff
      await notifyRole({
        role: "Receptionist",
        title: "New Laundry Order",
        message: `New laundry order for ${sanitizeText(newOrder.guest_name, 80)} (Room ${sanitizeText(newOrder.room_number, 20)})`,
        type: "laundry",
      });
      setIsAdding(false);
      setCart([]);
      setNewOrder({
        room_number: "",
        guest_name: "",
        total_price: 0,
        status: "Received",
      });
      setShowPrintConfirm(false);
      setIsConfirmed(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "laundry_orders");
    }
  };

  const handlePrintRequest = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowPrintConfirm(true);
    setIsConfirmed(false);
  };

  const handleAddOrderWrapper = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleAddOrder(e as any);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "laundry_services"), newService);
      setIsAddingService(false);
      setNewService({ name: "", price: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, "laundry_orders", orderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "laundry_orders");
    }
  };

  const deleteService = async (serviceId: string) => {
    try {
      await deleteDoc(doc(db, "laundry_services", serviceId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "laundry_services");
    }
  };

  const updateStatus = async (
    id: string,
    status: LaundryOrder["status"],
    estimatedArrival?: string,
  ) => {
    try {
      const updateData: Partial<LaundryOrder> = { status };
      if (estimatedArrival) updateData.estimated_arrival = estimatedArrival;
      await updateDoc(doc(db, "laundry_orders", id), updateData);

      await logger.info(
        "LAUNDRY",
        "UPDATE_STATUS",
        `Laundry order ${id} status updated to ${status}`,
        auth.currentUser?.uid,
        auth.currentUser?.displayName || undefined,
        { orderId: id, status, estimatedArrival },
      );

      // Create notification for the guest
      const order = orders.find((o) => o.id === id);
      if (order && order.customer_email) {
        await notifyUser({
          userId: order.customer_uid,
          title: "Laundry Update",
          message: buildLaundryStatusMessage(
            sanitizeText(status, 30),
            estimatedArrival ? sanitizeText(estimatedArrival, 40) : undefined,
          ),
          type: "laundry",
          orderId: id,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "laundry_orders");
    }
  };

  const [estArrival, setEstArrival] = useState<{ [key: string]: string }>({});

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-auto lg:h-[calc(100vh-12rem)]">
      <div className="flex-1 space-y-8 overflow-y-auto pr-0 lg:pr-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-8">
            <h2 className="text-xl md:text-2xl font-serif italic">
              Laundry Service
            </h2>
            <div className="flex bg-white/50 p-1 rounded-xl border border-black/5 w-fit overflow-x-auto">
              <button
                onClick={() => setActiveSubTab("orders")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeSubTab === "orders" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
              >
                Orders
              </button>
              <button
                onClick={() => setActiveSubTab("services")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeSubTab === "services" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
              >
                Services
              </button>
            </div>
          </div>
          {activeSubTab === "orders" ? (
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-xs sm:text-sm font-medium w-full sm:w-auto"
            >
              New Laundry Order
            </button>
          ) : (
            canManage && (
              <button
                onClick={() => setIsAddingService(true)}
                className="px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-xs sm:text-sm font-medium w-full sm:w-auto"
              >
                Add Service Type
              </button>
            )
          )}
        </div>

        {activeSubTab === "orders" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm relative group"
              >
                {isAdmin && (
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="absolute top-4 right-4 p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-mono text-black/30 uppercase tracking-widest">
                      {order.room_number
                        ? `Room ${order.room_number}`
                        : `Guest: ${order.guest_name}`}
                    </p>
                    <h3 className="text-lg font-serif italic">
                      {order.guest_name}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-black/40">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {order.estimated_arrival && (
                  <p className="text-[10px] font-mono text-blue-600 uppercase mb-2">
                    Est. Delivery: {order.estimated_arrival}
                  </p>
                )}
                <div className="flex items-center justify-between mb-6">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider
                    ${order.status === "Delivered" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}
                  >
                    {order.status}
                  </span>
                  <p className="font-serif italic">N$ {order.total_price}</p>
                </div>
                <div className="space-y-2">
                  {canManage && (
                    <select
                      value={order.status}
                      onChange={(e) =>
                        updateStatus(
                          order.id,
                          e.target.value as LaundryOrder["status"],
                          estArrival[order.id],
                        )
                      }
                      className="w-full p-2 bg-gray-50 border border-black/5 rounded-xl text-xs font-mono uppercase"
                    >
                      <option value="Received">Received</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Ready">Ready</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  )}
                  {order.status !== "Delivered" && (
                    <input
                      type="text"
                      placeholder="Est. Delivery (e.g. 2 hours)"
                      value={estArrival[order.id] || ""}
                      onChange={(e) =>
                        setEstArrival({
                          ...estArrival,
                          [order.id]: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-gray-50 border border-black/5 rounded-lg text-[10px] focus:outline-none"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {services.map((service) => (
              <motion.div
                key={service.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isAdmin && addToCart(service)}
                className="bg-white p-4 rounded-xl border border-black/5 shadow-sm flex justify-between items-center group text-left cursor-pointer"
              >
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-xs text-black/40 font-mono">
                    N$ {service.price}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteService(service.id);
                    }}
                    className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {!isAdmin && cart.length > 0 && (
        <div className="w-full lg:w-96 bg-white rounded-2xl border border-black/5 shadow-sm flex flex-col sticky bottom-0 lg:relative">
          <div className="p-6 border-bottom border-black/5">
            <h3 className="text-lg font-serif italic mb-4">Laundry Receipt</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Room Number"
                value={newOrder.room_number}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, room_number: e.target.value })
                }
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
              <input
                type="text"
                placeholder="Guest Name"
                value={newOrder.guest_name}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, guest_name: e.target.value })
                }
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item, i) => (
              <div
                key={i}
                className="flex justify-between items-center text-sm"
              >
                <div>
                  <p className="font-medium">{item.item.name}</p>
                  <p className="text-xs text-black/40">
                    N$ {item.item.price} x {item.qty}
                  </p>
                </div>
                <p className="font-serif italic">
                  N$ {item.item.price * item.qty}
                </p>
              </div>
            ))}
          </div>

          <div className="p-6 bg-gray-50 rounded-b-2xl border-t border-black/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase text-black/40">
                Total
              </span>
              <span className="text-xl font-serif italic">N$ {total}</span>
            </div>
            <button
              disabled={!newOrder.room_number || !newOrder.guest_name}
              onClick={handlePrintRequest}
              className="w-full py-3 sm:py-4 bg-[#141414] text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition-colors"
            >
              Print Receipt
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPrintConfirm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  Confirm Laundry Receipt
                </h3>
                <button
                  onClick={() => setShowPrintConfirm(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="border-b border-dashed border-black/10 pb-4">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-1">
                    Room {newOrder.room_number}
                  </p>
                  <p className="text-sm font-medium mb-4">
                    {newOrder.guest_name}
                  </p>
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span>
                        {item.item.name} x {item.qty}
                      </span>
                      <span>N$ {item.item.price * item.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-serif italic text-lg">
                  <span>Total</span>
                  <span>N$ {total}</span>
                </div>
              </div>

              {!isConfirmed ? (
                <button
                  onClick={() => setIsConfirmed(true)}
                  className="w-full py-4 bg-black text-white rounded-xl font-medium"
                >
                  Confirm Details
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs text-center font-medium">
                    Details confirmed. Ready to print.
                  </div>
                  <button
                    onClick={handleAddOrderWrapper}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Printer size={18} />
                    Print Now
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {isAdding && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">New Laundry Order</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddOrder} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.room_number}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, room_number: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Guest Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.guest_name}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, guest_name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Total Price (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newOrder.total_price}
                    onChange={(e) =>
                      setNewOrder({
                        ...newOrder,
                        total_price: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Create Order
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingService && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  Add Laundry Service
                </h3>
                <button
                  onClick={() => setIsAddingService(false)}
                  className="text-black/20 hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddService} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newService.name}
                    onChange={(e) =>
                      setNewService({ ...newService, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Price (N$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newService.price}
                    onChange={(e) =>
                      setNewService({
                        ...newService,
                        price: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4"
                >
                  Save Service
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
