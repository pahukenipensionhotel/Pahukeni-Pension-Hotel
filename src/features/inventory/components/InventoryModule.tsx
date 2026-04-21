import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, X, Printer } from "lucide-react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import { MenuItem } from "../../../shared/types/hotel";
import { handleFirestoreError, OperationType } from "../../../shared/validation/inputs";

export const InventoryModule = ({
  menu,
  isAdmin,
  userRole,
}: {
  menu: MenuItem[];
  isAdmin: boolean;
  userRole?: string;
}) => {
  const [isAddingStock, setIsAddingStock] = useState<string | null>(null);
  const [isDeductingStock, setIsDeductingStock] = useState<string | null>(null);
  const [stockAmount, setStockAmount] = useState(0);
  const [showReport, setShowReport] = useState(false);

  const barMenu = menu.filter((item) => item.type === "Bar");

  const handleUpdateStock = async (itemId: string, amount: number) => {
    try {
      const item = barMenu.find((m) => m.id === itemId);
      if (!item) return;
      const newStock = Math.max(0, (item.stock || 0) + amount);
      const newStatus = newStock === 0 ? "Out of Stock" : "Available";
      await updateDoc(doc(db, "menu_items", itemId), {
        stock: newStock,
        status: newStatus,
      });
      setIsAddingStock(null);
      setIsDeductingStock(null);
      setStockAmount(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "menu_items");
    }
  };

  const reportData = useMemo(() => {
    const available = barMenu.filter((item) => (item.stock || 0) > 0);
    const outOfStock = barMenu.filter((item) => (item.stock || 0) === 0);
    const totalValue = barMenu.reduce(
      (acc, item) => acc + (item.stock || 0) * (item.costPrice || 0),
      0,
    );

    return { available, outOfStock, totalValue };
  }, [barMenu]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-serif italic">
            Bar Inventory Management
          </h3>
          <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest">
            Track and manage beverage stock levels
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          className="px-4 py-2 bg-black text-white rounded-xl text-xs font-mono uppercase tracking-widest flex items-center gap-2"
        >
          <FileText size={14} />
          Daily Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {barMenu.map((item) => (
          <div
            key={item.id}
            className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-mono text-black/30 uppercase">
                  {item.category}
                </p>
                <h4 className="font-medium text-[#141414]">{item.name}</h4>
              </div>
              <span
                className={`px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider
                ${(item.stock || 0) <= (item.minStock || 5) ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}
              >
                Stock: {item.stock || 0}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#F5F5F0] p-3 rounded-xl">
                <p className="text-[8px] font-mono text-black/40 uppercase mb-1">
                  Cost Price
                </p>
                <p className="font-mono text-sm">N$ {item.costPrice || 0}</p>
              </div>
              <div className="bg-[#F5F5F0] p-3 rounded-xl">
                <p className="text-[8px] font-mono text-black/40 uppercase mb-1">
                  Selling Price
                </p>
                <p className="font-mono text-sm">N$ {item.price}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsAddingStock(item.id)}
                className="flex-1 py-2.5 bg-black text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-black/80 transition-colors"
              >
                Add Stock
              </button>
              <button
                onClick={() => setIsDeductingStock(item.id)}
                className="flex-1 py-2.5 bg-white text-black border border-black/10 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-black/5 transition-colors"
              >
                Deduct
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Stock Modal */}
      <AnimatePresence>
        {(isAddingStock || isDeductingStock) && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">
                  {isAddingStock ? "Add Stock" : "Deduct Stock"}
                </h3>
                <button
                  onClick={() => {
                    setIsAddingStock(null);
                    setIsDeductingStock(null);
                  }}
                  className="text-black/40 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest block mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={stockAmount}
                    onChange={(e) =>
                      setStockAmount(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/5 font-mono"
                    placeholder="Enter quantity..."
                  />
                </div>
                <button
                  onClick={() =>
                    handleUpdateStock(
                      (isAddingStock || isDeductingStock)!,
                      isAddingStock ? stockAmount : -stockAmount,
                    )
                  }
                  className="w-full py-4 bg-black text-white rounded-2xl text-xs font-mono uppercase tracking-widest hover:bg-black/80 transition-all"
                >
                  Confirm Update
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-serif italic">
                    End of Day Inventory Report
                  </h3>
                  <p className="text-[10px] font-mono text-black/40 uppercase tracking-widest mt-1">
                    {new Date().toLocaleDateString("en-US", {
                      dateStyle: "full",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setShowReport(false)}
                  className="text-black/40 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4 border-b border-black/5 pb-2">
                    Available Stock
                  </h4>
                  <div className="space-y-2">
                    {reportData.available.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center py-2 border-b border-black/5 last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-[10px] text-black/40">
                            Cost: N$ {item.costPrice} | Price: N$ {item.price}
                          </p>
                        </div>
                        <span className="font-mono text-sm">
                          {item.stock} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-red-400 mb-4 border-b border-red-100 pb-2">
                    Out of Stock
                  </h4>
                  <div className="space-y-2">
                    {reportData.outOfStock.length > 0 ? (
                      reportData.outOfStock.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center py-2 border-b border-black/5 last:border-0"
                        >
                          <p className="font-medium text-sm text-red-600">
                            {item.name}
                          </p>
                          <span className="font-mono text-sm text-red-600">
                            0 units
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-black/30 italic">
                        No items currently out of stock.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-[#141414] text-white p-6 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">
                        Total Inventory Value (Cost)
                      </p>
                      <p className="text-2xl font-serif italic">
                        N$ {reportData.totalValue.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
