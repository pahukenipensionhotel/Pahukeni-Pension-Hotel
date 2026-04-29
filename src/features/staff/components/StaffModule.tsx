import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  X,
  Users,
  User as UserIcon,
  Trash2,
} from "lucide-react";
import { initializeApp, getApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import firebaseConfig from "../../../../firebase-applet-config.json";
import { RoomBooking, User } from "../../../shared/types/hotel";
import { maskEmail } from "../../../shared/utils/security";
import {
  handleFirestoreError,
  OperationType,
} from "../../../shared/validation/inputs";

const ROLES: User["role"][] = [
  "Admin",
  "Receptionist",
  "Waiter",
  "Barman",
  "Laundry man",
];

export const StaffModule = ({
  users,
  bookings,
}: {
  users: User[];
  bookings: RoomBooking[];
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"staff" | "guests">("staff");
  const [isAdding, setIsAdding] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "Waiter" as User["role"],
  });

  const hotelStaff = users.filter((u) => u.role !== "Customer");
  const guests = users.filter((u) => u.role === "Customer");

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    let secondaryApp;
    try {
      try {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryAuth");
      } catch {
        secondaryApp = getApp("SecondaryAuth");
      }

      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newMember.email,
        newMember.password,
      );
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      const memberData = {
        name: newMember.name,
        username: newMember.username,
        email: newMember.email,
        role: newMember.role,
      };
      await setDoc(doc(db, "users", userCredential.user.uid), {
        ...memberData,
      });

      setIsAdding(false);
      setNewMember({
        name: "",
        username: "",
        email: "",
        password: "",
        role: activeSubTab === "staff" ? "Waiter" : "Customer",
      });
      alert(
        `${activeSubTab === "staff" ? "Staff member" : "Guest"} registered successfully.`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Registration error:", err);
      alert("Failed to register: " + message);
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (deleteError) {
          console.warn("Failed to clean up secondary auth app:", deleteError);
        }
      }
    }
  };

  const updateRole = async (userId: string, newRole: User["role"]) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "users");
    }
  };

  const getGuestBooking = (guestEmail?: string, guestId?: string) => {
    return bookings.find(
      (b) => b.guest_email === guestEmail || b.guest_uid === guestId,
    );
  };

  return (
    <div className="space-y-8">
      {/* Sub-tabs Navigation */}
      <div className="flex border-b border-black/5 gap-8">
        <button
          onClick={() => setActiveSubTab("staff")}
          className={`pb-4 text-sm font-medium transition-all relative ${activeSubTab === "staff" ? "text-black" : "text-black/40 hover:text-black"}`}
        >
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span>Hotel Staff</span>
          </div>
          {activeSubTab === "staff" && (
            <motion.div
              layoutId="staff-tab-underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
            />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab("guests")}
          className={`pb-4 text-sm font-medium transition-all relative ${activeSubTab === "guests" ? "text-black" : "text-black/40 hover:text-black"}`}
        >
          <div className="flex items-center gap-2">
            <UserIcon size={16} />
            <span>Hotel Guests</span>
          </div>
          {activeSubTab === "guests" && (
            <motion.div
              layoutId="staff-tab-underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
            />
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-serif italic capitalize">
            {activeSubTab === "staff" ? "Staff Management" : "Guest Management"}
          </h2>
          <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
            {activeSubTab === "staff"
              ? `${hotelStaff.length} registered staff members`
              : `${guests.length} registered guests`}
          </p>
        </div>
        <button
          onClick={() => {
            setNewMember({
              ...newMember,
              role: activeSubTab === "staff" ? "Waiter" : "Customer",
            });
            setIsAdding(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all w-full sm:w-auto text-xs sm:text-sm font-medium"
        >
          <Plus size={16} />
          <span>Add {activeSubTab === "staff" ? "Staff" : "Guest"}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-black/5">
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                User Details
              </th>
              {activeSubTab === "staff" ? (
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Role & Account
                </th>
              ) : (
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                  Booking Status
                </th>
              )}
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">
                Username
              </th>
              <th className="p-6 text-[10px] font-mono uppercase text-black/40 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {(activeSubTab === "staff" ? hotelStaff : guests).map((user) => {
              const booking = getGuestBooking(user.email, user.id);
              return (
                <tr
                  key={user.id}
                  className="border-b border-black/5 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                        <UserIcon size={14} className="text-black/40" />
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-[10px] font-mono text-black/30">
                          {maskEmail(user.email)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    {activeSubTab === "staff" ? (
                      <select
                        value={user.role}
                        onChange={(e) =>
                          updateRole(user.id, e.target.value as User["role"])
                        }
                        className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                        <option value="Customer">Move to Guests</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        {booking ? (
                          <>
                            <div
                              className={`w-2 h-2 rounded-full ${booking.status === "Active" ? "bg-emerald-500" : "bg-orange-500"}`}
                            />
                            <span className="text-xs font-medium">
                              {booking.status} - Room {booking.room_number}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-gray-300" />
                            <span className="text-xs text-black/40">
                              No active bookings
                            </span>
                          </>
                        )}
                        <select
                          value={user.role}
                          onChange={(e) =>
                            updateRole(user.id, e.target.value as User["role"])
                          }
                          className="ml-4 bg-gray-50 px-2 py-1 rounded text-[10px] font-mono uppercase border-none focus:ring-0 cursor-pointer text-black/40 hover:text-black transition-colors"
                        >
                          <option value="Customer">Guest</option>
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              Make {role}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="p-6 text-sm font-mono text-black/60">
                    {user.username}
                  </td>
                  <td className="p-6 text-right">
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="p-2 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Register Dialog */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-serif italic">
                    Add New {activeSubTab === "staff" ? "Staff" : "Guest"}
                  </h3>
                  <p className="text-[10px] font-mono text-black/40 uppercase mt-1">
                    Provision a new system account
                  </p>
                </div>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newMember.name}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:ring-1 focus:ring-black/5 outline-none transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newMember.username}
                    onChange={(e) =>
                      setNewMember({ ...newMember, username: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:ring-1 focus:ring-black/5 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:ring-1 focus:ring-black/5 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newMember.password}
                    onChange={(e) =>
                      setNewMember({ ...newMember, password: e.target.value })
                    }
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:ring-1 focus:ring-black/5 outline-none transition-all"
                    placeholder="Min. 6 characters"
                  />
                </div>
                {activeSubTab === "staff" && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">
                      Assign Role
                    </label>
                    <select
                      value={newMember.role}
                      onChange={(e) =>
                        setNewMember({
                          ...newMember,
                          role: e.target.value as User["role"],
                        })
                      }
                      className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:ring-1 focus:ring-black/5 outline-none transition-all"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4 hover:bg-black/90 transition-all shadow-lg shadow-black/10"
                >
                  Register {activeSubTab === "staff" ? "Staff Member" : "Guest"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
