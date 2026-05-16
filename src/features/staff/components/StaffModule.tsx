import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Users, User as UserIcon, Trash2 } from "lucide-react";
import { initializeApp, getApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import { User, RoomBooking } from "../../../shared/types/hotel";
import { maskEmail } from "../../../shared/utils/security";
import {
  handleFirestoreError,
  OperationType,
} from "../../../shared/validation/inputs";
import { logger } from "../../../shared/utils/logger";
import { auth } from "../../../services/firebase/client";
import { useFormSubmission } from "../../../shared/hooks/useFormSubmission";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const ROLES = ["Admin", "Receptionist", "Waiter", "Barman", "Laundry man"];

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

  const handleAddMember = async (_e: React.FormEvent) => {
    let secondaryApp;
    try {
      try {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryAuth");
      } catch (e) {
        secondaryApp = getApp("SecondaryAuth");
      }

      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newMember.email,
        newMember.password,
      );

      // Send verification email to the new staff/guest
      await sendEmailVerification(userCredential.user);

      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      const { password: _password, ...memberData } = newMember;

      // The Firestore rules I just deployed ensure only an Admin can write to /users
      // with a non-'Customer' role.
      await setDoc(doc(db, "users", userCredential.user.uid), {
        ...memberData,
      });

      await logger.info(
        "STAFF",
        "ADD_MEMBER",
        `${activeSubTab === "staff" ? "Staff" : "Guest"} created and provisioned: ${memberData.email} (${memberData.role})`,
        auth.currentUser?.uid,
        auth.currentUser?.displayName || undefined,
        { targetUid: userCredential.user.uid, role: memberData.role },
      );

      setIsAdding(false);
      setNewMember({
        name: "",
        username: "",
        email: "",
        password: "",
        role: activeSubTab === "staff" ? "Waiter" : "Customer",
      });
      alert(
        `${activeSubTab === "staff" ? "Staff member" : "Guest"} registered successfully. A verification email has been sent to them.`,
      );
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("Registration error:", error);
      alert("Failed to register: " + error.message);
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          // Ignore secondary app cleanup errors
        }
      }
    }
  };

  const { handleSubmit: submitMember, isSubmitting } =
    useFormSubmission(handleAddMember);

  const updateRole = async (userId: string, newRole: User["role"]) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      await logger.info(
        "STAFF",
        "UPDATE_ROLE",
        `Role updated for user ${userId} to ${newRole}`,
        auth.currentUser?.uid,
        auth.currentUser?.displayName || undefined,
        { targetUid: userId, newRole },
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      await logger.warn(
        "STAFF",
        "DELETE_USER",
        `User deleted: ${userId}`,
        auth.currentUser?.uid,
        auth.currentUser?.displayName || undefined,
        { targetUid: userId },
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "users");
    }
  };

  const getGuestBooking = (guestEmail?: string, guestId?: string) => {
    return bookings.find(
      (b) => b.customer_email === guestEmail || b.guest_uid === guestId,
    );
  };

  return (
    <div className="flex flex-col h-full space-y-8 overflow-hidden">
      {/* Sub-tabs Navigation */}
      <div className="flex border-b border-black/5 gap-8 shrink-0">
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-3xl font-serif italic capitalize tracking-tight text-[#141414]">
            {activeSubTab === "staff" ? "Staff Registry" : "Guest Registry"}
          </h2>
          <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
            {activeSubTab === "staff"
              ? `${hotelStaff.length} verified staff members`
              : `${guests.length} verified guests`}
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
          className="flex items-center justify-center gap-3 px-6 py-4 bg-[#141414] text-white rounded-2xl shadow-xl shadow-black/10 hover:bg-black/90 transition-all btn-interactive text-xs font-bold uppercase tracking-widest"
        >
          <Plus size={18} />
          <span>Provision {activeSubTab === "staff" ? "Staff" : "Guest"}</span>
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50/80 backdrop-blur-md border-b border-black/5">
                <th className="p-8 text-[11px] font-mono font-bold uppercase text-black/40 tracking-[0.2em]">
                  User Identity
                </th>
                {activeSubTab === "staff" ? (
                  <th className="p-8 text-[11px] font-mono font-bold uppercase text-black/40 tracking-[0.2em]">
                    Role & Authority
                  </th>
                ) : (
                  <th className="p-8 text-[11px] font-mono font-bold uppercase text-black/40 tracking-[0.2em]">
                    Stay Status
                  </th>
                )}
                <th className="p-8 text-[11px] font-mono font-bold uppercase text-black/40 tracking-[0.2em]">
                  Handle
                </th>
                <th className="p-8 text-[11px] font-mono font-bold uppercase text-black/40 tracking-[0.2em] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {(activeSubTab === "staff" ? hotelStaff : guests).map((user) => {
                const booking = getGuestBooking(user.email, user.id);
                return (
                  <tr
                    key={user.id}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="p-8">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center border border-black/5 group-hover:bg-black group-hover:text-white transition-all duration-500 shadow-sm">
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-[#141414] text-lg tracking-tight">
                            {user.name}
                          </p>
                          <p className="text-[12px] font-mono text-black/30">
                            {maskEmail(user.email)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-8">
                      {activeSubTab === "staff" ? (
                        <select
                          value={user.role}
                          onChange={(e) =>
                            updateRole(user.id, e.target.value as User["role"])
                          }
                          className="bg-transparent border-none text-sm font-bold text-[#141414] focus:ring-0 cursor-pointer hover:bg-black/5 rounded-xl px-3 py-2 transition-all"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                          <option value="Customer">Move to Guests</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-5">
                          {booking ? (
                            <>
                              <div
                                className={`w-3 h-3 rounded-full shadow-sm ${booking.status === "Active" || booking.status === "Checked In" ? "bg-emerald-500 animate-pulse" : "bg-orange-500"}`}
                              />
                              <span className="text-sm font-bold text-[#141414]">
                                {booking.status} â€¢ Unit {booking.room_number}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-3 h-3 rounded-full bg-black/5 border border-black/5" />
                              <span className="text-sm text-black/30 font-medium tracking-tight">
                                No active registry
                              </span>
                            </>
                          )}
                          <select
                            value={user.role}
                            onChange={(e) =>
                              updateRole(
                                user.id,
                                e.target.value as User["role"],
                              )
                            }
                            className="ml-auto bg-gray-100/50 px-4 py-2 rounded-xl text-[10px] font-mono font-black uppercase border-none focus:ring-0 cursor-pointer text-black/40 hover:text-black hover:bg-white hover:shadow-md transition-all"
                          >
                            <option value="Customer">Guest</option>
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                Promote to {role}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="p-8 text-sm font-mono font-bold text-black/40 uppercase tracking-tighter">
                      @{user.username}
                    </td>
                    <td className="p-8 text-right">
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="p-4 text-black/10 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90 shadow-sm hover:shadow-md"
                        title="Delete User"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Dialog */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-black/5"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-serif italic text-[#141414]">
                    New Account Provision
                  </h3>
                  <p className="text-[10px] font-mono text-black/30 uppercase tracking-[0.3em] mt-2">
                    Security-First User Registry
                  </p>
                </div>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-3 bg-black/5 hover:bg-black/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={submitMember} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest ml-1">
                      Full Identity
                    </label>
                    <input
                      type="text"
                      required
                      value={newMember.name}
                      onChange={(e) =>
                        setNewMember({ ...newMember, name: e.target.value })
                      }
                      className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl focus:bg-white focus:border-black/10 outline-none transition-all text-sm"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest ml-1">
                      System Handle
                    </label>
                    <input
                      type="text"
                      required
                      value={newMember.username}
                      onChange={(e) =>
                        setNewMember({ ...newMember, username: e.target.value })
                      }
                      className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl focus:bg-white focus:border-black/10 outline-none transition-all text-sm"
                      placeholder="jdoe_admin"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest ml-1">
                    Verified Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl focus:bg-white focus:border-black/10 outline-none transition-all text-sm"
                    placeholder="verify@domain.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest ml-1">
                    Secure Key
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newMember.password}
                    onChange={(e) =>
                      setNewMember({ ...newMember, password: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl focus:bg-white focus:border-black/10 outline-none transition-all text-sm"
                    placeholder="Min. 8 characters"
                  />
                </div>
                {activeSubTab === "staff" && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest ml-1">
                      Privilege Level
                    </label>
                    <select
                      value={newMember.role}
                      onChange={(e) =>
                        setNewMember({
                          ...newMember,
                          role: e.target.value as User["role"],
                        })
                      }
                      className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none transition-all text-sm font-bold text-black/60"
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
                  disabled={isSubmitting}
                  className="w-full py-5 bg-black text-white rounded-2xl font-bold uppercase tracking-[0.3em] text-[11px] mt-4 hover:bg-black/90 transition-all shadow-2xl shadow-black/20 active:scale-95 btn-interactive"
                >
                  {isSubmitting ? "Commiting..." : "Commit Provisioning"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
