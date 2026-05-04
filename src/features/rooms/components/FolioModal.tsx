import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Receipt, CreditCard, History, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { doc, updateDoc, writeBatch, arrayUnion } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import { RoomBooking, Folio, FolioCharge, Room } from "../../../shared/types/hotel";
import { logger } from "../../../shared/utils/logger";

interface FolioModalProps {
  booking: RoomBooking;
  folio?: Folio;
  rooms: Room[];
  onClose: () => void;
}

export const FolioModal = ({ booking, folio, rooms, onClose }: FolioModalProps) => {
  const [activeTab, setActiveSubTab] = useState<"summary" | "post" | "deposit">("summary");
  const [loading, setLoading] = useState(false);

  // Post Charge Form
  const [chargeForm, setChargeForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "Bar" as FolioCharge["category"],
    description: "",
    amount: "",
    reference: "",
  });

  // Deposit Form
  const [depositForm, setDepositForm] = useState({
    amount: "",
    description: "Security Deposit",
  });

  const handlePostCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    setLoading(true);

    try {
      const amount = parseFloat(chargeForm.amount);
      const newCharge: FolioCharge = {
        id: Math.random().toString(36).substring(2, 9),
        date: new Date(chargeForm.date).toISOString(),
        category: chargeForm.category,
        description: chargeForm.description,
        amount,
        reference: chargeForm.reference,
        staff_name: "Receptionist", // Should be actual user
        timestamp: new Date().toISOString(),
      };

      const folioRef = doc(db, "folios", folio.id);
      await updateDoc(folioRef, {
        charges: arrayUnion(newCharge),
        total_charges: (folio.total_charges || 0) + amount,
        balance_due: (folio.balance_due || 0) + amount,
      });

      await logger.info(
        "ORDER",
        "FOLIO_CHARGE_POSTED",
        `Post ${chargeForm.category} charge of N$ ${amount} to Room ${booking.room_number} folio`,
        undefined,
        "Staff User",
        { bookingId: booking.id, category: chargeForm.category, amount }
      );

      setChargeForm({
        date: format(new Date(), "yyyy-MM-dd"),
        category: "Bar",
        description: "",
        amount: "",
        reference: "",
      });
      setActiveSubTab("summary");
    } catch (err) {
      console.error(err);
      alert("Failed to post charge");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    setLoading(true);

    try {
      const amount = parseFloat(depositForm.amount);
      const newDeposit = {
        amount,
        date: new Date().toISOString(),
        description: depositForm.description,
      };

      const folioRef = doc(db, "folios", folio.id);
      await updateDoc(folioRef, {
        deposits: arrayUnion(newDeposit),
        total_deposits: (folio.total_deposits || 0) + amount,
        balance_due: (folio.balance_due || 0) - amount,
      });

      setDepositForm({ amount: "", description: "Security Deposit" });
      setActiveSubTab("summary");
    } catch (err) {
      console.error(err);
      alert("Failed to record deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!confirm(`Confirm checkout for Room ${booking.room_number}? Total Balance Due: N$ ${folio?.balance_due}`)) return;
    setLoading(true);

    try {
      const batch = writeBatch(db);

      // 1. Update Booking
      batch.update(doc(db, "room_bookings", booking.id), { status: "Checked Out" });

      // 2. Update Room
      const room = rooms.find(r => r.number === booking.room_number);
      if (room) {
        batch.update(doc(db, "rooms", room.id), { status: "Cleaning" });
      }

      await batch.commit();

      await logger.info(
        "BOOKING",
        "CHECKOUT_COMPLETED",
        `Guest ${booking.guest_name} checked out from Room ${booking.room_number}. Final Folio Balance settled.`,
        undefined,
        "Staff User",
        { bookingId: booking.id, finalBalance: folio?.balance_due }
      );

      onClose();
    } catch (err) {
      console.error(err);
      alert("Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (!folio) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-4xl border border-black/5 flex flex-col h-[90vh]"
      >
        <div className="p-8 border-b border-black/5 flex justify-between items-center bg-[#141414] text-white">
          <div>
            <h3 className="text-2xl font-serif italic">Guest Folio</h3>
            <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest mt-1">
              Room {booking.room_number} • {booking.guest_name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-black/5 bg-gray-50 p-2 gap-2">
          <button
            onClick={() => setActiveSubTab("summary")}
            className={`px-6 py-3 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all
              ${activeTab === "summary" ? "bg-white text-black shadow-sm font-bold" : "text-black/40 hover:text-black/60"}`}
          >
            <History size={14} className="inline mr-2" /> Statement Summary
          </button>
          <button
            onClick={() => setActiveSubTab("post")}
            className={`px-6 py-3 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all
              ${activeTab === "post" ? "bg-white text-black shadow-sm font-bold" : "text-black/40 hover:text-black/60"}`}
          >
            <Plus size={14} className="inline mr-2" /> Post Charge
          </button>
          <button
            onClick={() => setActiveSubTab("deposit")}
            className={`px-6 py-3 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all
              ${activeTab === "deposit" ? "bg-white text-black shadow-sm font-bold" : "text-black/40 hover:text-black/60"}`}
          >
            <CreditCard size={14} className="inline mr-2" /> Record Deposit
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "summary" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-6 rounded-2xl border border-black/5">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-1">Total Room Charges</p>
                  <p className="text-2xl font-serif italic">N$ {booking.total_price}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl border border-black/5">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-1">Extra Folio Charges</p>
                  <p className="text-2xl font-serif italic">N$ {folio.total_charges}</p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-mono uppercase text-emerald-700/60 mb-1">Advance Deposits</p>
                  <p className="text-2xl font-serif italic text-emerald-900">N$ {folio.total_deposits}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-mono uppercase text-black/40 font-bold tracking-widest">Transaction History</h4>
                <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] font-mono uppercase text-black/40 border-b border-black/5">
                      <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Description</th>
                        <th className="p-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      <tr className="bg-blue-50/30">
                        <td className="p-4 font-mono text-[10px]">{format(new Date(booking.check_in), "dd MMM yyyy")}</td>
                        <td className="p-4 font-bold">Room</td>
                        <td className="p-4">
                          Room Night Stay (Consolidated)
                          <span className="block text-[10px] opacity-50">
                            Payment Method: {booking.payment_method || "N/A"}
                          </span>
                        </td>
                        <td className="p-4 text-right">N$ {booking.total_price}</td>
                      </tr>
                      {folio.charges.map(charge => (
                        <tr key={charge.id}>
                          <td className="p-4 font-mono text-[10px]">{format(new Date(charge.date), "dd MMM yyyy HH:mm")}</td>
                          <td className="p-4 font-bold">{charge.category}</td>
                          <td className="p-4 text-black/60">{charge.description} {charge.reference && <span className="text-[10px] block opacity-40">Ref: {charge.reference}</span>}</td>
                          <td className="p-4 text-right font-medium">N$ {charge.amount}</td>
                        </tr>
                      ))}
                      {folio.deposits.map((dep, i) => (
                        <tr key={`dep-${i}`} className="text-emerald-600 bg-emerald-50/20 italic">
                          <td className="p-4 font-mono text-[10px]">{format(new Date(dep.date), "dd MMM yyyy")}</td>
                          <td className="p-4 font-bold">DEPOSIT</td>
                          <td className="p-4">{dep.description}</td>
                          <td className="p-4 text-right font-bold">- N$ {dep.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold border-t border-black/10">
                      <tr>
                        <td colSpan={3} className="p-6 text-right uppercase tracking-widest text-[10px]">Net Balance Due</td>
                        <td className="p-6 text-right text-xl font-serif">N$ {folio.balance_due}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "post" && (
            <form onSubmit={handlePostCharge} className="max-w-xl mx-auto space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-2 font-bold tracking-widest">Expense Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Bar", "Restaurant", "Other"].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setChargeForm({ ...chargeForm, category: cat as any })}
                        className={`py-3 rounded-xl border text-xs font-mono uppercase transition-all ${
                          chargeForm.category === cat ? "bg-black text-white border-black" : "bg-gray-50 text-black/40 border-black/5"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <input
                    required
                    type="date"
                    value={chargeForm.date}
                    onChange={(e) =>
                      setChargeForm({ ...chargeForm, date: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm"
                  />
                  <input
                    required
                    type="text"
                    placeholder="Description (e.g. 4x Draught Beers)"
                    value={chargeForm.description}
                    onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      required
                      type="number"
                      step="0.01"
                      placeholder="Amount (N$)"
                      value={chargeForm.amount}
                      onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                      className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Reference / Receipt #"
                      value={chargeForm.reference}
                      onChange={(e) => setChargeForm({ ...chargeForm, reference: e.target.value })}
                      className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm"
                    />
                  </div>
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-black/90 transition-all shadow-xl shadow-black/10"
                >
                  {loading ? "Posting..." : "Confirm & Post Charge"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "deposit" && (
            <form onSubmit={handleAddDeposit} className="max-w-xl mx-auto space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
                <div className="space-y-4">
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Deposit Amount (N$)"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm font-bold"
                  />
                  <input
                    required
                    type="text"
                    placeholder="Description"
                    value={depositForm.description}
                    onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm"
                  />
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/10"
                >
                  {loading ? "Recording..." : "Record Advance Payment"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="p-8 border-t border-black/5 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${folio.balance_due > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-black/40">Settlement Balance</p>
              <p className="text-2xl font-serif font-black">N$ {folio.balance_due}</p>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="px-12 py-4 bg-[#141414] text-white rounded-2xl font-medium hover:bg-black transition-all shadow-2xl shadow-black/20"
          >
            Pay & Finalize Checkout
          </button>
        </div>
      </motion.div>
    </div>
  );
};
