import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, CreditCard, History, AlertCircle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { doc, updateDoc, writeBatch, arrayUnion } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import {
  ConferenceBooking,
  ConferenceFolio,
  ConferenceFolioCharge,
  ReceiptDetails,
} from "../../../shared/types/hotel";
import { logger } from "../../../shared/utils/logger";

interface ConferenceFolioModalProps {
  booking: ConferenceBooking;
  folio?: ConferenceFolio;
  onClose: () => void;
  onStatusChange: (newStatus: ConferenceBooking["status"]) => void;
}

export const ConferenceFolioModal = ({
  booking,
  folio,
  onClose,
  onStatusChange,
}: ConferenceFolioModalProps) => {
  const [activeTab, setActiveSubTab] = useState<"summary" | "post" | "deposit">("summary");
  const [loading, setLoading] = useState(false);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);

  const [checkoutPayment, setCheckoutPayment] = useState<"Cash" | "Card" | "Receipt">(
    booking.payment_method || "Cash",
  );
  const [checkoutReceipt, setCheckoutReceipt] = useState<ReceiptDetails>({
    company_name: booking.receipt_details?.company_name || "",
    contact_person: booking.receipt_details?.contact_person || "",
    receipt_number: booking.receipt_details?.receipt_number || "",
    amount: booking.receipt_details?.amount || folio?.balance_due || 0,
  });

  const [chargeForm, setChargeForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    amount: "",
  });

  const [depositForm, setDepositForm] = useState({
    amount: "",
    description: "Deposit",
  });

  const handlePostCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    setLoading(true);

    try {
      const amount = parseFloat(chargeForm.amount);
      const newCharge: ConferenceFolioCharge = {
        id: Math.random().toString(36).substring(2, 9),
        date: new Date(chargeForm.date).toISOString(),
        description: chargeForm.description,
        amount,
        staff_name: "Staff User",
        timestamp: new Date().toISOString(),
      };

      const folioRef = doc(db, "conference_folios", folio.id);
      await updateDoc(folioRef, {
        charges: arrayUnion(newCharge),
        total_charges: (folio.total_charges || 0) + amount,
        balance_due: (folio.balance_due || 0) + amount,
      });

      await logger.info(
        "ORDER",
        "CONFERENCE_FOLIO_CHARGE_POSTED",
        `Post charge of N$ ${amount} to ${booking.room_name} folio`,
        undefined,
        "Staff User",
        { bookingId: booking.id, amount },
      );

      setChargeForm({
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        amount: "",
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

      const folioRef = doc(db, "conference_folios", folio.id);
      await updateDoc(folioRef, {
        deposits: arrayUnion(newDeposit),
        total_deposits: (folio.total_deposits || 0) + amount,
        balance_due: (folio.balance_due || 0) - amount,
      });

      setDepositForm({ amount: "", description: "Deposit" });
      setActiveSubTab("summary");
    } catch (err) {
      console.error(err);
      alert("Failed to record deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    setLoading(true);

    try {
      const batch = writeBatch(db);

      const bookingData: Record<string, unknown> = {
        status: "Checked Out",
        payment_method: checkoutPayment,
      };
      if (checkoutPayment === "Receipt") {
        bookingData.receipt_details = checkoutReceipt;
      }
      batch.update(doc(db, "conference_bookings", booking.id), bookingData);

      batch.update(doc(db, "conference_rooms", booking.room_id), {
        status: "Available",
      });

      batch.update(doc(db, "conference_folios", folio.id), {
        balance_due: 0,
      });

      await batch.commit();

      await logger.info(
        "BOOKING",
        "CONFERENCE_CHECKOUT_COMPLETED",
        `Client ${booking.client_name} checked out from ${booking.room_name}. Final balance: N$ ${folio.balance_due}`,
        undefined,
        "Staff User",
        { bookingId: booking.id, finalBalance: folio.balance_due, paymentMethod: checkoutPayment },
      );

      onStatusChange("Checked Out");
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
            <h3 className="text-2xl font-serif italic">
              {showCheckoutForm ? "Settle & Finalize Checkout" : "Conference Folio"}
            </h3>
            <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest mt-1">
              {booking.room_name} &bull; {booking.client_name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        {!showCheckoutForm && (
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
        )}

        <div className="flex-1 overflow-y-auto p-8">
          {showCheckoutForm ? (
            <form onSubmit={handleCheckout} className="max-w-2xl mx-auto space-y-8">
              <div className="bg-gray-50 p-8 rounded-3xl border border-black/5 text-center">
                <p className="text-[10px] font-mono uppercase text-black/40 tracking-widest mb-2">
                  Total Balance Due
                </p>
                <p className="text-5xl font-serif italic font-black">
                  N$ {folio.balance_due}
                </p>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
                <h4 className="text-[10px] font-mono uppercase text-black/40 font-bold tracking-widest">
                  Payment Method
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {(["Cash", "Card", "Receipt"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCheckoutPayment(method)}
                      className={`py-4 px-4 rounded-2xl border text-xs font-mono uppercase tracking-widest transition-all ${
                        checkoutPayment === method
                          ? "bg-black text-white border-black shadow-lg"
                          : "bg-gray-50 text-black/40 border-black/5 hover:border-black/20"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {checkoutPayment === "Receipt" && (
                  <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 space-y-4">
                    <p className="text-[10px] font-mono uppercase text-blue-800/60 font-bold tracking-widest">
                      Receipt Details
                    </p>
                    <input
                      required
                      type="text"
                      placeholder="Company / Organization Name"
                      value={checkoutReceipt.company_name}
                      onChange={(e) =>
                        setCheckoutReceipt({ ...checkoutReceipt, company_name: e.target.value })
                      }
                      className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none text-sm"
                    />
                    <input
                      required
                      type="text"
                      placeholder="Contact Person Name"
                      value={checkoutReceipt.contact_person}
                      onChange={(e) =>
                        setCheckoutReceipt({ ...checkoutReceipt, contact_person: e.target.value })
                      }
                      className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none text-sm"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        required
                        type="text"
                        placeholder="Receipt Number"
                        value={checkoutReceipt.receipt_number}
                        onChange={(e) =>
                          setCheckoutReceipt({ ...checkoutReceipt, receipt_number: e.target.value })
                        }
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none text-sm"
                      />
                      <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="Amount (N$)"
                        value={checkoutReceipt.amount || ""}
                        onChange={(e) =>
                          setCheckoutReceipt({ ...checkoutReceipt, amount: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full p-3 bg-white border border-blue-200 rounded-xl outline-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          ) : activeTab === "summary" ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-6 rounded-2xl border border-black/5">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-1">Room Charges</p>
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
                        <th className="p-4">Description</th>
                        <th className="p-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      <tr className="bg-blue-50/30">
                        <td className="p-4 font-mono text-[10px]">{format(new Date(booking.start_time), "dd MMM yyyy")}</td>
                        <td className="p-4 font-bold">Conference Room Booking</td>
                        <td className="p-4 text-right">N$ {booking.total_price}</td>
                      </tr>
                      {folio.charges.map((charge) => (
                        <tr key={charge.id}>
                          <td className="p-4 font-mono text-[10px]">{format(new Date(charge.date), "dd MMM yyyy HH:mm")}</td>
                          <td className="p-4 text-black/60">{charge.description}</td>
                          <td className="p-4 text-right font-medium">N$ {charge.amount}</td>
                        </tr>
                      ))}
                      {folio.deposits.map((dep, i) => (
                        <tr key={`dep-${i}`} className="text-emerald-600 bg-emerald-50/20 italic">
                          <td className="p-4 font-mono text-[10px]">{format(new Date(dep.date), "dd MMM yyyy")}</td>
                          <td className="p-4 font-bold">DEPOSIT</td>
                          <td className="p-4 text-right font-bold">- N$ {dep.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold border-t border-black/10">
                      <tr>
                        <td colSpan={2} className="p-6 text-right uppercase tracking-widest text-[10px]">Net Balance Due</td>
                        <td className="p-6 text-right text-xl font-serif">N$ {folio.balance_due}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === "post" ? (
            <form onSubmit={handlePostCharge} className="max-w-xl mx-auto space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
                <div className="space-y-4">
                  <input
                    required
                    type="date"
                    value={chargeForm.date}
                    onChange={(e) => setChargeForm({ ...chargeForm, date: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm"
                  />
                  <input
                    required
                    type="text"
                    placeholder="Description (e.g. Catering service)"
                    value={chargeForm.description}
                    onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm"
                  />
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Amount (N$)"
                    value={chargeForm.amount}
                    onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl outline-none text-sm font-bold"
                  />
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
          ) : (
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
          {showCheckoutForm ? (
            <>
              <button
                type="button"
                onClick={() => setShowCheckoutForm(false)}
                className="px-6 py-4 border border-black/10 rounded-2xl text-xs font-mono uppercase tracking-widest text-black/50 hover:bg-white transition-all"
              >
                <ArrowLeft size={16} className="inline mr-2" /> Back
              </button>
              <button
                onClick={(e) => handleCheckout(e as any)}
                disabled={loading}
                className="px-12 py-4 bg-[#141414] text-white rounded-2xl font-medium hover:bg-black transition-all shadow-2xl shadow-black/20"
              >
                {loading ? "Processing..." : `Confirm Checkout — N$ ${folio.balance_due}`}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${folio.balance_due > 0 ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase text-black/40">Settlement Balance</p>
                  <p className="text-2xl font-serif font-black">N$ {folio.balance_due}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCheckoutForm(true)}
                disabled={loading}
                className="px-12 py-4 bg-[#141414] text-white rounded-2xl font-medium hover:bg-black transition-all shadow-2xl shadow-black/20"
              >
                Pay & Finalize Checkout
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
