import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  RefreshCw,
  Trash2,
  X,
  FileText,
  Printer,
  Edit2,
} from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import { MenuItem, Order, User, OrderItem } from "../../../shared/types/hotel";
import {
  canManagePosMenu,
  canManageInventory as canManageInventoryRole,
} from "../../../shared/security/authorization";
import {
  handleFirestoreError,
  OperationType,
  requireText,
  sanitizeText,
} from "../../../shared/validation/inputs";
import { IMAGE_CATALOG } from "../../../shared/assets/imageCatalog";
import {
  notifyRole,
  notifyUser,
  buildOrderStatusMessage,
} from "../../notifications/services/notificationWorkflow";
import { InventoryModule } from "../../inventory/components/InventoryModule";
import { createEmptyMenuItemDraft } from "../repositories/menuRepository";
import { logger } from "../../../shared/utils/logger";
import { auth } from "../../../services/firebase/client";

const LOCAL_ASSETS = IMAGE_CATALOG;

export const POSModule = ({
  type,
  menu,
  orders,
  isAdmin,
  userRole,
}: {
  type: "Restaurant" | "Bar";
  menu: MenuItem[];
  orders: Order[];
  isAdmin: boolean;
  userRole?: string;
}) => {
  const [cart, setCart] = useState<{ item: MenuItem; qty: number }[]>([]);
  const [table, setTable] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState(() => createEmptyMenuItemDraft(type));
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const canManageMenu = canManagePosMenu(
    type,
    userRole as User["role"] | undefined,
  );
  const canManageInventory = canManageInventoryRole(
    userRole as User["role"] | undefined,
  );
  const moduleShowcase =
    type === "Restaurant"
      ? {
          title: "Dining Spaces",
          description:
            "Use the real restaurant imagery to ground the POS experience in the property itself.",
          images: LOCAL_ASSETS.showcase.restaurant,
        }
      : {
          title: "Bar Atmosphere",
          description:
            "The bar workspace now carries actual venue photography from the property.",
          images: LOCAL_ASSETS.showcase.bar,
        };

  const [activeSubTab, setActiveSubTab] = useState<string>(
    type === "Restaurant" ? "orders" : "menu",
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!moduleShowcase.images.length) return;
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % moduleShowcase.images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [moduleShowcase.images.length]);

  useEffect(() => {
    setNewItem(createEmptyMenuItemDraft(type));
  }, [type]);

  const filteredMenu = menu.filter((item) => item.type === type);
  const filteredOrders = orders
    .filter((order) => order.type === type)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing)
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...prev, { item, qty: 1 }];
    });
  };

  const total = cart.reduce((sum, i) => sum + i.item.price * i.qty, 0);

  const handlePlaceOrder = async () => {
    try {
      await addDoc(collection(db, "orders"), {
        table_number: table,
        items: cart.map((c) => ({
          ...c.item,
          qty: c.qty,
        })),
        total_price: total,
        status: "Pending",
        type,
        created_at: new Date().toISOString(),
        placed_by: userRole,
      });

      await logger.info(
        "ORDER",
        "PLACE_ORDER",
        `New ${type} order placed for table ${table || "Walk-in"}`,
        auth.currentUser?.uid,
        auth.currentUser?.displayName || undefined,
        { type, table, total, itemsCount: cart.length },
      );

      if (type === "Bar") {
        await notifyRole({
          role: "Barman",
          title: "New Bar Order",
          message: `New order for Table ${sanitizeText(table || "Walk-in", 40)} placed by ${sanitizeText(userRole || "Guest", 40)}`,
          type: "order",
        });
      } else if (type === "Restaurant") {
        await notifyRole({
          role: "Waiter",
          title: "New Restaurant Order",
          message: `New order for Table ${sanitizeText(table || "Walk-in", 40)} placed by ${sanitizeText(userRole || "Reception", 40)}`,
          type: "order",
        });
      }

      if (type === "Bar") {
        for (const cartItem of cart) {
          const menuItem = menu.find((m) => m.id === cartItem.item.id);
          if (menuItem && menuItem.stock !== undefined) {
            const newStock = Math.max(0, menuItem.stock - cartItem.qty);
            await updateDoc(doc(db, "menu_items", menuItem.id), {
              stock: newStock,
              status: newStock === 0 ? "Out of Stock" : "Available",
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      setCart([]);
      setTable("");
      setShowPrintConfirm(false);
      setIsConfirmed(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "orders");
    }
  };

  const handlePrintRequest = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowPrintConfirm(true);
    setIsConfirmed(false);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageMenu && !isAdmin) {
      alert("You do not have permission to add menu items.");
      return;
    }

    let payload;
    try {
      const name = requireText(newItem.name, "Name", 80);
      const category = requireText(newItem.category, "Category", 60);

      payload = {
        name,
        category,
        price: Number.isFinite(newItem.price) ? Math.max(0, newItem.price) : 0,
        costPrice: Number.isFinite(newItem.costPrice)
          ? Math.max(0, newItem.costPrice)
          : 0,
        stock: Number.isFinite(newItem.stock) ? Math.max(0, newItem.stock) : 0,
        minStock: Number.isFinite(newItem.minStock)
          ? Math.max(0, newItem.minStock)
          : 0,
        type,
        status:
          type === "Bar" && Math.max(0, newItem.stock) === 0
            ? "Out of Stock"
            : "Available",
      };
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
        return;
      }
      throw err;
    }

    try {
      if (editingItemId) {
        await updateDoc(doc(db, "menu_items", editingItemId), {
          ...payload,
          updated_at: new Date().toISOString(),
        });
        setEditingItemId(null);
      } else {
        await addDoc(collection(db, "menu_items"), {
          ...payload,
          created_at: new Date().toISOString(),
        });
      }
      setIsAdding(false);
      setNewItem(createEmptyMenuItemDraft(type));
    } catch (err) {
      if (err instanceof Error && err.message.includes("permission-denied")) {
        alert(
          "Permission denied while creating menu item. Deploy latest Firestore rules and verify role access.",
        );
        return;
      }
      if (err instanceof Error) {
        alert(err.message);
        return;
      }
      handleFirestoreError(err, OperationType.CREATE, "menu_items");
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "menu_items", itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "menu_items");
    }
  };

  const toggleItemStatus = async (item: MenuItem) => {
    try {
      const newStatus =
        item.status === "Available" ? "Out of Stock" : "Available";
      await updateDoc(doc(db, "menu_items", item.id), {
        status: newStatus,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("permission-denied")) {
        alert(
          "Permission denied while updating menu item. Deploy latest Firestore rules and verify role access.",
        );
        return;
      }
      if (err instanceof Error) {
        alert(err.message);
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, "menu_items");
    }
  };

  const startEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setNewItem({
      name: item.name,
      category: item.category,
      price: item.price,
      costPrice: item.costPrice ?? 0,
      stock: item.stock ?? 0,
      minStock: item.minStock ?? 5,
      type: item.type,
      status: item.status,
    });
    setIsAdding(true);
  };

  const updateOrderStatus = async (
    orderId: string,
    newStatus: Order["status"],
    estimatedArrival?: string,
  ) => {
    try {
      const updateData: Partial<Order> = { status: newStatus };
      if (estimatedArrival) updateData.estimated_arrival = estimatedArrival;
      await updateDoc(doc(db, "orders", orderId), updateData);

      await logger.info(
        "ORDER",
        "UPDATE_STATUS",
        `Order ${orderId} status updated to ${newStatus}`,
        auth.currentUser?.uid,
        auth.currentUser?.displayName || undefined,
        { orderId, newStatus, estimatedArrival },
      );

      const order = orders.find((o) => o.id === orderId);
      if (order && order.customer_email) {
        await notifyUser({
          userId: order.customer_uid,
          title: "Order Update",
          message: buildOrderStatusMessage(
            type,
            sanitizeText(newStatus, 30),
            estimatedArrival ? sanitizeText(estimatedArrival, 40) : undefined,
          ),
          type: "order",
          orderId: orderId,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "orders");
    }
  };

  const [estArrival, setEstArrival] = useState<{ [key: string]: string }>({});

  const incomingOrders = filteredOrders.filter((o) => o.status === "Pending");
  const activeOrders = filteredOrders.filter(
    (o) =>
      o.status !== "Pending" &&
      o.status !== "Completed" &&
      o.status !== "Cancelled" &&
      o.status !== "Paid",
  );

  return (
    <div className="flex flex-col gap-8 h-auto lg:h-[calc(100vh-12rem)]">
      {/* Sub-navigation */}
      <div className="flex bg-white/50 p-1 rounded-xl border border-black/5 w-fit">
        {type === "Restaurant" ? (
          <>
            <button
              onClick={() => setActiveSubTab("orders")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "orders" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Live Orders
            </button>
            <button
              onClick={() => setActiveSubTab("menu")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "menu" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Menu Management
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveSubTab("menu")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "menu" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Bar POS
            </button>
            <button
              onClick={() => setActiveSubTab("orders")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === "orders" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
            >
              Orders
            </button>
            {canManageInventory && (
              <button
                onClick={() => setActiveSubTab("inventory")}
                className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                  ${activeSubTab === "inventory" ? "bg-black text-white shadow-md" : "text-black/40 hover:text-black/60"}`}
              >
                Inventory
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto pr-0 lg:pr-4">
          {activeSubTab === "inventory" ? (
            <InventoryModule
              menu={menu}
              isAdmin={isAdmin}
              userRole={userRole}
            />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-serif italic">
                  {type} {activeSubTab === "orders" ? "Live Orders" : "Menu"}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  {(activeSubTab === "menu" || activeSubTab === "inventory") &&
                    canManageMenu && (
                      <button
                        onClick={() => {
                          setEditingItemId(null);
                          setNewItem(createEmptyMenuItemDraft(type));
                          setIsAdding(true);
                        }}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-black text-white rounded-xl text-[10px] sm:text-xs font-mono uppercase tracking-widest whitespace-nowrap"
                      >
                        Add Item
                      </button>
                    )}
                  <div className="relative flex-1 sm:flex-none">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder={
                        activeSubTab === "menu"
                          ? "Search menu..."
                          : "Search orders..."
                      }
                      className="w-full sm:w-auto pl-9 pr-4 py-1.5 sm:py-2 bg-white border border-black/5 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-black/20"
                    />
                  </div>
                </div>
              </div>

              {activeSubTab === "menu" && (
                <div
                  className={`grid gap-4 ${moduleShowcase.images.length > 1 ? "grid-cols-1 lg:grid-cols-[1.35fr,1fr]" : "grid-cols-1"}`}
                >
                  <div className="relative overflow-hidden rounded-3xl border border-black/5 min-h-70">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={moduleShowcase.images[activeImageIndex]}
                        src={moduleShowcase.images[activeImageIndex]}
                        alt={moduleShowcase.title}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </AnimatePresence>
                    <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/25 to-transparent" />
                    <div className="relative flex h-full flex-col justify-end p-6 text-white">
                      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/60">
                        {type === "Restaurant" ? "Restaurant" : "Bar"}
                      </p>
                      <h3 className="mt-2 text-2xl font-serif italic">
                        {moduleShowcase.title}
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-white/80">
                        {moduleShowcase.description}
                      </p>
                    </div>
                  </div>
                  {moduleShowcase.images.length > 1 && (
                    <div className="grid grid-cols-2 gap-4">
                      {moduleShowcase.images
                        .filter((_, idx) => idx !== activeImageIndex)
                        .slice(0, 2)
                        .map((image, index) => (
                          <div
                            key={image}
                            className="relative overflow-hidden rounded-3xl border border-black/5 min-h-45"
                          >
                            <img
                              loading="lazy"
                              src={image}
                              alt={`${moduleShowcase.title} ${index + 2}`}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {activeSubTab === "menu" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMenu.map((item) => (
                    <motion.div
                      key={item.id}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-white p-4 rounded-2xl border border-black/5 text-left hover:shadow-md transition-all group relative
                        ${item.status === "Out of Stock" ? "opacity-60" : ""}`}
                    >
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {canManageMenu && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditItem(item);
                              }}
                              className="p-1 text-sky-400 hover:text-sky-600 transition-colors"
                              title="Edit Item"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemStatus(item);
                              }}
                              className={`p-1 rounded-lg transition-colors ${item.status === "Available" ? "text-orange-400 hover:text-orange-600" : "text-emerald-400 hover:text-emerald-600"}`}
                              title={
                                item.status === "Available"
                                  ? "Mark Out of Stock"
                                  : "Mark Available"
                              }
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMenuItem(item.id);
                              }}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          item.status === "Available" && addToCart(item)
                        }
                        disabled={item.status === "Out of Stock"}
                        className="w-full h-full text-left"
                      >
                        <div className="mb-1 flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-mono text-black/30 uppercase mb-1">
                              {item.category}
                            </p>
                            <p className="font-medium text-[#141414] group-hover:text-black transition-colors">
                              {item.name}
                            </p>
                          </div>
                          <div className="text-right">
                            {item.status === "Out of Stock" && (
                              <span className="text-[8px] font-mono bg-red-50 text-red-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                Out of Stock
                              </span>
                            )}
                            <p className="text-sm font-serif italic mt-1">
                              N$ {item.price}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-black/40 mt-2">
                          {item.type}
                        </p>
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <h3 className="text-sm font-mono uppercase tracking-widest text-black/60">
                        Received Orders
                      </h3>
                    </div>
                    {activeOrders.length === 0 ? (
                      <div className="bg-white/50 p-8 rounded-2xl border border-dashed border-black/10 text-center">
                        <p className="text-xs text-black/30 font-mono">
                          No orders in process
                        </p>
                      </div>
                    ) : (
                      activeOrders.map((order) => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-serif italic text-lg">
                                {order.customer_name
                                  ? `Guest: ${order.customer_name}`
                                  : `Table ${order.table_number}`}
                              </h4>
                              <p className="text-[10px] font-mono text-black/40 uppercase">
                                {new Date(
                                  order.created_at,
                                ).toLocaleTimeString()}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider
                              ${
                                order.status === "Accepted"
                                  ? "bg-blue-50 text-blue-600"
                                  : order.status === "Preparing"
                                    ? "bg-purple-50 text-purple-600"
                                    : order.status === "Serving"
                                      ? "bg-indigo-50 text-indigo-600"
                                      : "bg-gray-50 text-gray-600"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>

                          <div className="space-y-1 mb-4 border-y border-black/5 py-3">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-black/60">
                                  {item.name} x {item.qty}
                                </span>
                                <span className="font-mono opacity-40">
                                  N$ {item.price * item.qty}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-2 font-serif italic text-sm">
                              <span>Total</span>
                              <span>N$ {order.total_price}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {order.status === "Accepted" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "Preparing")
                                }
                                className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-purple-700 transition-colors"
                              >
                                Start Prep
                              </button>
                            )}
                            {order.status === "Preparing" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "Serving")
                                }
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                              >
                                Ready
                              </button>
                            )}
                            {order.status === "Serving" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(order.id, "Completed")
                                }
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              onClick={() =>
                                updateOrderStatus(order.id, "Cancelled")
                              }
                              className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-red-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></div>
                      <h3 className="text-sm font-mono uppercase tracking-widest text-black/60">
                        Incoming Orders
                      </h3>
                    </div>
                    {incomingOrders.length === 0 ? (
                      <div className="bg-white/50 p-8 rounded-2xl border border-dashed border-black/10 text-center">
                        <p className="text-xs text-black/30 font-mono">
                          No new orders
                        </p>
                      </div>
                    ) : (
                      incomingOrders.map((order) => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-serif italic text-lg text-orange-900">
                                {order.customer_name
                                  ? `Guest: ${order.customer_name}`
                                  : `Table ${order.table_number}`}
                              </h4>
                              <p className="text-[10px] font-mono text-orange-600/60 uppercase">
                                Just arrived •{" "}
                                {new Date(
                                  order.created_at,
                                ).toLocaleTimeString()}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-mono uppercase tracking-wider animate-pulse">
                              New
                            </span>
                          </div>

                          <div className="space-y-1 mb-4 border-y border-orange-200/30 py-3">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-xs text-orange-800/80"
                              >
                                <span>
                                  {item.name} x {item.qty}
                                </span>
                                <span className="font-mono opacity-60">
                                  N$ {item.price * item.qty}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-3">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Est. Arrival (e.g. 20m)"
                                value={estArrival[order.id] || ""}
                                onChange={(e) =>
                                  setEstArrival({
                                    ...estArrival,
                                    [order.id]: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-orange-200 rounded-xl text-xs focus:outline-none focus:border-orange-400"
                              />
                            </div>
                            <button
                              onClick={() =>
                                updateOrderStatus(
                                  order.id,
                                  "Accepted",
                                  estArrival[order.id],
                                )
                              }
                              className="px-6 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
                            >
                              Accept
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {activeSubTab === "menu" && cart.length > 0 && (
          <div className="w-full lg:w-96 bg-white rounded-2xl border border-black/5 shadow-sm flex flex-col sticky bottom-0 lg:relative">
            <div className="p-6 border-bottom border-black/5">
              <h3 className="text-lg font-serif italic mb-4">Current Order</h3>
              <input
                type="text"
                placeholder="Table Number"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-[#141414]">
                      {item.item.name}
                    </span>
                    <span className="text-[10px] text-black/40 font-mono">
                      N$ {item.item.price} each
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setCart((prev) =>
                          prev
                            .map((i) =>
                              i.item.id === item.item.id
                                ? { ...i, qty: i.qty - 1 }
                                : i,
                            )
                            .filter((i) => i.qty > 0),
                        );
                      }}
                      className="w-6 h-6 rounded-full border border-black/5 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                      -
                    </button>
                    <span className="font-mono text-xs w-4 text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => addToCart(item.item)}
                      className="w-6 h-6 rounded-full border border-black/5 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-gray-50 border-t border-black/5 space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest">
                  Total
                </p>
                <p className="text-2xl font-serif italic">N$ {total}</p>
              </div>
              <button
                onClick={handlePrintRequest}
                className="w-full py-4 bg-black text-white rounded-xl text-xs font-mono uppercase tracking-widest hover:bg-black/90 transition-all shadow-lg shadow-black/10"
              >
                Place Order
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-serif italic">
                  {editingItemId ? "Edit Menu Item" : "Add Menu Item"}
                </h3>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingItemId(null);
                    setNewItem(createEmptyMenuItemDraft(type));
                  }}
                  className="text-black/40 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5"
                    placeholder="Item name..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                      Price (N$)
                    </label>
                    <input
                      type="number"
                      required
                      value={newItem.price}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                      Cost (N$)
                    </label>
                    <input
                      type="number"
                      required
                      value={newItem.costPrice}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          costPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5"
                    placeholder="e.g. Beverages"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      value={newItem.stock}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          stock: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                      Min Alert
                    </label>
                    <input
                      type="number"
                      value={newItem.minStock}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          minStock: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-2xl text-xs font-mono uppercase tracking-widest hover:bg-black/80 transition-all mt-4"
                >
                  {editingItemId ? "Update Menu Item" : "Create Menu Item"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrintConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-serif italic mb-2">
                  Order Confirmed
                </h3>
                <p className="text-sm text-black/40">
                  The order has been recorded in the system.
                </p>
              </div>

              <div className="bg-[#F5F5F0] p-6 rounded-2xl mb-8 space-y-3">
                <div className="flex justify-between text-xs font-mono uppercase tracking-wider text-black/40">
                  <span>Destination</span>
                  <span>{table || "Walk-in"}</span>
                </div>
                <div className="flex justify-between text-xs font-mono uppercase tracking-wider text-black/40 border-b border-black/5 pb-3">
                  <span>Total Amount</span>
                  <span className="text-black font-bold">N$ {total}</span>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsConfirmed(true);
                      window.print();
                    }}
                    className="w-full py-3 border border-black/10 rounded-xl text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black/5 transition-colors"
                  >
                    <Printer size={14} />
                    Print Receipt
                  </button>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                className="w-full py-4 bg-black text-white rounded-2xl text-xs font-mono uppercase tracking-widest hover:bg-black/80 transition-all"
              >
                Proceed to Kitchen/Bar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
import { CheckCircle2 } from "lucide-react";
