import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  LayoutDashboard, 
  Bed, 
  Utensils, 
  Beer, 
  WashingMachine, 
  Calendar, 
  FileText, 
  Users, 
  LogOut,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Printer,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Stats, Room, MenuItem, Order, LaundryOrder, User } from './types';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  getAuth
} from 'firebase/auth';
import { initializeApp, getApp, deleteApp } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  getDocs,
  getDoc,
  Timestamp,
  orderBy,
  deleteDoc
} from 'firebase/firestore';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if ((this.state as any).hasError) {
      let displayError = (this.state as any).error;
      let isFirestoreError = false;
      try {
        const parsed = JSON.parse(displayError.message);
        if (parsed.operationType) {
          displayError = parsed;
          isFirestoreError = true;
        }
      } catch (e) {}

      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-100">
            <h2 className="text-2xl font-serif text-red-600 mb-4">System Error</h2>
            <p className="text-sm text-gray-600 mb-6">
              {isFirestoreError 
                ? `A database error occurred during ${displayError.operationType} on ${displayError.path}.` 
                : 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <pre className="bg-gray-50 p-4 rounded-xl text-[10px] font-mono overflow-auto mb-6 max-h-40">
              {JSON.stringify(displayError, null, 2)}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-medium"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Components ---

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-black/5"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif italic text-[#141414] mb-2">Pahukeni Pension</h1>
          <p className="text-sm text-black/50 uppercase tracking-widest font-mono">Management System</p>
        </div>
        
        <div className="space-y-6">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white text-black border border-black/10 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono">
              <span className="bg-white px-2 text-black/30">Or use credentials</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-black/40 mb-2">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-[#f5f5f5] border border-black/5 rounded-xl focus:outline-none focus:border-black/20 transition-colors"
                placeholder="admin@pahukeni.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-black/40 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-[#f5f5f5] border border-black/5 rounded-xl focus:outline-none focus:border-black/20 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-red-500 text-xs font-mono">{error}</p>}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#141414] text-white rounded-xl font-medium hover:bg-black/90 transition-colors shadow-lg shadow-black/10 disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const Dashboard = ({ stats, bookings }: { stats: Stats | null, bookings: any[] }) => {
  if (!stats) return null;

  const cards = [
    { label: 'Active Guests', value: stats.activeGuests, icon: Users, color: 'text-blue-600' },
    { label: 'Available Rooms', value: stats.availableRooms, icon: Bed, color: 'text-emerald-600' },
    { label: 'Pending Laundry', value: stats.pendingLaundry, icon: WashingMachine, color: 'text-orange-600' },
    { label: 'Daily Revenue', value: `N$ ${stats.totalRevenue.toLocaleString()}`, icon: FileText, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl bg-gray-50 ${card.color}`}>
                <card.icon size={20} />
              </div>
              <span className="text-[10px] font-mono text-black/30 uppercase tracking-wider">Live</span>
            </div>
            <h3 className="text-2xl font-serif italic text-[#141414]">{card.value}</h3>
            <p className="text-xs font-mono text-black/40 uppercase mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
          <h2 className="text-xl font-serif italic mb-6">Recent Bookings</h2>
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <p className="text-sm text-black/20 font-mono text-center py-8">No recent activity</p>
            ) : (
              bookings.slice(0, 5).map((booking, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-black/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-black/5">
                      <Clock size={16} className="text-black/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{booking.guest_name || 'Guest'} - Room {booking.room_number}</p>
                      <p className="text-[10px] font-mono text-black/40">{booking.status}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-black/20" />
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
          <h2 className="text-xl font-serif italic mb-6">System Status</h2>
          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 flex items-center gap-4">
            <CheckCircle2 size={24} />
            <div>
              <p className="text-sm font-medium">All systems operational</p>
              <p className="text-xs opacity-70">Database connected and syncing in real-time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const POSModule = ({ type, menu, isAdmin }: { type: 'Restaurant' | 'Bar', menu: MenuItem[], isAdmin: boolean }) => {
  const [cart, setCart] = useState<{ item: any, qty: number }[]>([]);
  const [table, setTable] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: 0, category: '', type });
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const filteredMenu = menu.filter(item => item.type === type);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { item, qty: 1 }];
    });
  };

  const total = cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0);

  const handlePlaceOrder = async () => {
    try {
      await addDoc(collection(db, 'orders'), {
        table_number: table,
        items: cart.map(c => ({ name: c.item.name, price: c.item.price, qty: c.qty })),
        total_price: total,
        status: 'Pending',
        type,
        created_at: new Date().toISOString()
      });
      setCart([]);
      setTable('');
      setShowPrintConfirm(false);
      setIsConfirmed(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    }
  };

  const handlePrintRequest = () => {
    setShowPrintConfirm(true);
    setIsConfirmed(false);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'menu_items'), newItem);
      setIsAdding(false);
      setNewItem({ name: '', price: 0, category: '', type });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'menu_items');
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'menu_items', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'menu_items');
    }
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-12rem)]">
      <div className="flex-1 space-y-6 overflow-y-auto pr-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif italic">{type} POS</h2>
          <div className="flex gap-4">
            {isAdmin && (
              <button 
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 bg-black text-white rounded-xl text-xs font-mono uppercase tracking-widest"
              >
                Add Item
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
              <input 
                type="text" 
                placeholder="Search menu..." 
                className="pl-10 pr-4 py-2 bg-white border border-black/5 rounded-xl text-sm focus:outline-none focus:border-black/20"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMenu.map((item) => (
            <motion.div
              key={item.id}
              whileTap={{ scale: 0.98 }}
              className="bg-white p-4 rounded-2xl border border-black/5 text-left hover:shadow-md transition-all group relative"
            >
              {isAdmin && (
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteMenuItem(item.id); }}
                  className="absolute top-2 right-2 p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 z-10"
                >
                  <X size={14} />
                </button>
              )}
              <button 
                onClick={() => addToCart(item)}
                className="w-full h-full text-left"
              >
                <p className="text-[10px] font-mono text-black/30 uppercase mb-1">{item.category}</p>
                <p className="font-medium text-[#141414] group-hover:text-black transition-colors">{item.name}</p>
                <p className="text-sm font-serif italic mt-2">N$ {item.price}</p>
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {!isAdmin && cart.length > 0 && (
        <div className="w-96 bg-white rounded-2xl border border-black/5 shadow-sm flex flex-col">
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
              <div key={i} className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium">{item.item.name}</p>
                  <p className="text-xs text-black/40">N$ {item.item.price} x {item.qty}</p>
                </div>
                <p className="font-serif italic">N$ {item.item.price * item.qty}</p>
              </div>
            ))}
          </div>

          <div className="p-6 bg-gray-50 rounded-b-2xl border-t border-black/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase text-black/40">Total</span>
              <span className="text-xl font-serif italic">N$ {total}</span>
            </div>
            <button 
              disabled={!table}
              onClick={handlePrintRequest}
              className="w-full py-4 bg-[#141414] text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition-colors"
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
                <h3 className="text-xl font-serif italic">Confirm Receipt</h3>
                <button onClick={() => setShowPrintConfirm(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="border-b border-dashed border-black/10 pb-4">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-2">Table {table}</p>
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span>{item.item.name} x {item.qty}</span>
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
                    onClick={handlePlaceOrder}
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
                <h3 className="text-xl font-serif italic">Add Menu Item</h3>
                <button onClick={() => setIsAdding(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Item Name</label>
                  <input 
                    type="text" 
                    required
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Price (N$)</label>
                  <input 
                    type="number" 
                    required
                    value={newItem.price}
                    onChange={(e) => setNewItem({...newItem, price: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Category</label>
                  <input 
                    type="text" 
                    required
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    placeholder="e.g. Main, Drinks, Starter"
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
                  Save Item
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RoomsModule = ({ rooms, isAdmin }: { rooms: Room[], isAdmin: boolean }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newRoom, setNewRoom] = useState({ number: '', category: 'Single', price: 0, status: 'Available' as any });

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'rooms'), newRoom);
      setIsAdding(false);
      setNewRoom({ number: '', category: 'Single', price: 0, status: 'Available' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'rooms');
    }
  };

  const deleteRoom = async (roomId: string) => {
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'rooms');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif italic">Room Management</h2>
        <div className="flex gap-4">
          {isAdmin && (
            <button 
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-sm font-medium"
            >
              Add Room
            </button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-black/5 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-black/5 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span>Occupied</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {rooms.map((room) => (
          <motion.div 
            key={room.id}
            whileHover={{ y: -4 }}
            className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-all relative group"
          >
            {isAdmin && (
              <button 
                onClick={() => deleteRoom(room.id)}
                className="absolute top-4 right-4 p-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
              >
                <X size={16} />
              </button>
            )}
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-mono text-black/30 uppercase tracking-widest">{room.category}</p>
                <h3 className="text-2xl font-serif italic">Room {room.number}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider
                ${room.status === 'Available' ? 'bg-emerald-50 text-emerald-700' : 
                  room.status === 'Occupied' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                {room.status}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-black/40">Rate</span>
                <span className="font-medium">N$ {room.price} / night</span>
              </div>
              <button className="w-full py-3 bg-gray-50 border border-black/5 rounded-xl text-xs font-mono uppercase tracking-widest hover:bg-black hover:text-white transition-all">
                {room.status === 'Available' ? 'Check In' : 'Manage'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

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
                <h3 className="text-xl font-serif italic">Add New Room</h3>
                <button onClick={() => setIsAdding(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddRoom} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Room Number</label>
                  <input 
                    type="text" 
                    required
                    value={newRoom.number}
                    onChange={(e) => setNewRoom({...newRoom, number: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Category</label>
                  <select 
                    value={newRoom.category}
                    onChange={(e) => setNewRoom({...newRoom, category: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  >
                    <option value="Single">Single</option>
                    <option value="Double">Double</option>
                    <option value="VIP">VIP</option>
                    <option value="Suite">Suite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Price (N$)</label>
                  <input 
                    type="number" 
                    required
                    value={newRoom.price}
                    onChange={(e) => setNewRoom({...newRoom, price: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
                  Save Room
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LaundryModule = ({ orders, services, isAdmin }: { orders: LaundryOrder[], services: any[], isAdmin: boolean }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'services'>('orders');
  const [newOrder, setNewOrder] = useState({ room_number: '', guest_name: '', total_price: 0, status: 'Received' as any });
  const [newService, setNewService] = useState({ name: '', price: 0 });
  const [cart, setCart] = useState<{ item: any, qty: number }[]>([]);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const total = cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { item, qty: 1 }];
    });
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'laundry_orders'), {
        room_number: newOrder.room_number,
        guest_name: newOrder.guest_name,
        total_price: total,
        status: 'Received',
        items: cart.map(c => ({ name: c.item.name, price: c.item.price, qty: c.qty })),
        created_at: new Date().toISOString()
      });
      setIsAdding(false);
      setCart([]);
      setNewOrder({ room_number: '', guest_name: '', total_price: 0, status: 'Received' });
      setShowPrintConfirm(false);
      setIsConfirmed(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'laundry_orders');
    }
  };

  const handlePrintRequest = () => {
    setShowPrintConfirm(true);
    setIsConfirmed(false);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'laundry_services'), newService);
      setIsAddingService(false);
      setNewService({ name: '', price: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'laundry_orders', orderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'laundry_orders');
    }
  };

  const deleteService = async (serviceId: string) => {
    try {
      await deleteDoc(doc(db, 'laundry_services', serviceId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'laundry_services');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'laundry_orders', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'laundry_orders');
    }
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-12rem)]">
      <div className="flex-1 space-y-8 overflow-y-auto pr-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h2 className="text-2xl font-serif italic">Laundry Service</h2>
            <div className="flex bg-white/50 p-1 rounded-xl border border-black/5">
              <button 
                onClick={() => setActiveSubTab('orders')}
                className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                  ${activeSubTab === 'orders' ? 'bg-black text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
              >
                Orders
              </button>
              <button 
                onClick={() => setActiveSubTab('services')}
                className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                  ${activeSubTab === 'services' ? 'bg-black text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
              >
                Services
              </button>
            </div>
          </div>
          {activeSubTab === 'orders' ? (
            <button 
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-sm font-medium"
            >
              New Laundry Order
            </button>
          ) : (
            isAdmin && (
              <button 
                onClick={() => setIsAddingService(true)}
                className="px-6 py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-sm font-medium"
              >
                Add Service Type
              </button>
            )
          )}
        </div>

        {activeSubTab === 'orders' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm relative group">
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
                    <p className="text-[10px] font-mono text-black/30 uppercase tracking-widest">Room {order.room_number}</p>
                    <h3 className="text-lg font-serif italic">{order.guest_name}</h3>
                  </div>
                  <span className="text-xs font-mono text-black/40">{new Date(order.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center justify-between mb-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider
                    ${order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                    {order.status}
                  </span>
                  <p className="font-serif italic">N$ {order.total_price}</p>
                </div>
                <select 
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  className="w-full p-2 bg-gray-50 border border-black/5 rounded-xl text-xs font-mono uppercase"
                >
                  <option value="Received">Received</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Ready">Ready</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {services.map((service) => (
              <motion.button 
                key={service.id} 
                whileTap={{ scale: 0.98 }}
                onClick={() => !isAdmin && addToCart(service)}
                className="bg-white p-4 rounded-xl border border-black/5 shadow-sm flex justify-between items-center group text-left"
              >
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-xs text-black/40 font-mono">N$ {service.price}</p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteService(service.id); }}
                    className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {!isAdmin && cart.length > 0 && (
        <div className="w-96 bg-white rounded-2xl border border-black/5 shadow-sm flex flex-col">
          <div className="p-6 border-bottom border-black/5">
            <h3 className="text-lg font-serif italic mb-4">Laundry Receipt</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Room Number" 
                value={newOrder.room_number}
                onChange={(e) => setNewOrder({...newOrder, room_number: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
              <input 
                type="text" 
                placeholder="Guest Name" 
                value={newOrder.guest_name}
                onChange={(e) => setNewOrder({...newOrder, guest_name: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium">{item.item.name}</p>
                  <p className="text-xs text-black/40">N$ {item.item.price} x {item.qty}</p>
                </div>
                <p className="font-serif italic">N$ {item.item.price * item.qty}</p>
              </div>
            ))}
          </div>

          <div className="p-6 bg-gray-50 rounded-b-2xl border-t border-black/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase text-black/40">Total</span>
              <span className="text-xl font-serif italic">N$ {total}</span>
            </div>
            <button 
              disabled={!newOrder.room_number || !newOrder.guest_name}
              onClick={handlePrintRequest}
              className="w-full py-4 bg-[#141414] text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/90 transition-colors"
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
                <h3 className="text-xl font-serif italic">Confirm Laundry Receipt</h3>
                <button onClick={() => setShowPrintConfirm(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="border-b border-dashed border-black/10 pb-4">
                  <p className="text-[10px] font-mono uppercase text-black/40 mb-1">Room {newOrder.room_number}</p>
                  <p className="text-sm font-medium mb-4">{newOrder.guest_name}</p>
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span>{item.item.name} x {item.qty}</span>
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
                    onClick={handleAddOrder}
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
                <button onClick={() => setIsAdding(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddOrder} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Room Number</label>
                  <input 
                    type="text" 
                    required
                    value={newOrder.room_number}
                    onChange={(e) => setNewOrder({...newOrder, room_number: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Guest Name</label>
                  <input 
                    type="text" 
                    required
                    value={newOrder.guest_name}
                    onChange={(e) => setNewOrder({...newOrder, guest_name: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Total Price (N$)</label>
                  <input 
                    type="number" 
                    required
                    value={newOrder.total_price}
                    onChange={(e) => setNewOrder({...newOrder, total_price: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
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
                <h3 className="text-xl font-serif italic">Add Laundry Service</h3>
                <button onClick={() => setIsAddingService(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddService} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Service Name</label>
                  <input 
                    type="text" 
                    required
                    value={newService.name}
                    onChange={(e) => setNewService({...newService, name: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Price (N$)</label>
                  <input 
                    type="number" 
                    required
                    value={newService.price}
                    onChange={(e) => setNewService({...newService, price: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
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

const ConferenceModule = ({ rooms, services, bookings, isAdmin }: { rooms: any[], services: any[], bookings: any[], isAdmin: boolean }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [activeSubTab, setActiveSubTab] = useState<'facilities' | 'services' | 'bookings'>('facilities');
  
  const [newRoom, setNewRoom] = useState({ name: '', capacity: 0, price_per_hour: 0, status: 'Available' as any });
  const [newService, setNewService] = useState({ name: '', price: 0 });
  const [newBooking, setNewBooking] = useState({ 
    client_name: '', 
    date: new Date().toISOString().split('T')[0], 
    start_time: '09:00', 
    end_time: '17:00',
    selectedServices: [] as string[]
  });

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'conference_rooms'), newRoom);
      setIsAdding(false);
      setNewRoom({ name: '', capacity: 0, price_per_hour: 0, status: 'Available' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'conference_rooms');
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'conference_services'), newService);
      setIsAddingService(false);
      setNewService({ name: '', price: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacility) return;

    try {
      const startTime = new Date(`${newBooking.date}T${newBooking.start_time}`);
      const endTime = new Date(`${newBooking.date}T${newBooking.end_time}`);
      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      let totalPrice = durationHours * selectedFacility.price_per_hour;
      
      // Add services price
      newBooking.selectedServices.forEach(serviceId => {
        const service = services.find(s => s.id === serviceId);
        if (service) totalPrice += service.price;
      });

      await addDoc(collection(db, 'conference_bookings'), {
        room_id: selectedFacility.id,
        room_name: selectedFacility.name,
        client_name: newBooking.client_name,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        services: newBooking.selectedServices,
        total_price: totalPrice,
        status: 'Confirmed'
      });

      setIsBooking(false);
      setSelectedFacility(null);
      setNewBooking({ 
        client_name: '', 
        date: new Date().toISOString().split('T')[0], 
        start_time: '09:00', 
        end_time: '17:00',
        selectedServices: []
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteFacility = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'conference_rooms', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'conference_rooms');
    }
  };

  const deleteService = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'conference_services', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'conference_services');
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'conference_bookings', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'conference_bookings');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h2 className="text-2xl font-serif italic">Conference Facilities</h2>
          <div className="flex bg-white/50 p-1 rounded-xl border border-black/5">
            <button 
              onClick={() => setActiveSubTab('facilities')}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === 'facilities' ? 'bg-black text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
            >
              Facilities
            </button>
            <button 
              onClick={() => setActiveSubTab('bookings')}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === 'bookings' ? 'bg-black text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
            >
              Bookings
            </button>
            <button 
              onClick={() => setActiveSubTab('services')}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-all
                ${activeSubTab === 'services' ? 'bg-black text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
            >
              Services
            </button>
          </div>
        </div>
        {activeSubTab === 'facilities' ? (
          isAdmin && (
            <button 
              onClick={() => setIsAdding(true)}
              className="px-6 py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-sm font-medium"
            >
              Add Facility
            </button>
          )
        ) : activeSubTab === 'services' ? (
          isAdmin && (
            <button 
              onClick={() => setIsAddingService(true)}
              className="px-6 py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all text-sm font-medium"
            >
              Add Service
            </button>
          )
        ) : null}
      </div>

      {activeSubTab === 'facilities' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm relative group">
              {isAdmin && (
                <button 
                  onClick={() => deleteFacility(room.id)}
                  className="absolute top-4 right-4 p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                >
                  <X size={16} />
                </button>
              )}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-mono text-black/30 uppercase tracking-widest">Capacity: {room.capacity} pax</p>
                  <h3 className="text-xl font-serif italic">{room.name}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider
                  ${room.status === 'Available' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                  {room.status}
                </span>
              </div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs text-black/40">Rate</span>
                <span className="font-serif italic">N$ {room.price_per_hour} / hour</span>
              </div>
              <button 
                onClick={() => { setSelectedFacility(room); setIsBooking(true); }}
                className="w-full py-3 bg-gray-50 border border-black/5 rounded-xl text-xs font-mono uppercase tracking-widest hover:bg-black hover:text-white transition-all"
              >
                Book Facility
              </button>
            </div>
          ))}
        </div>
      ) : activeSubTab === 'bookings' ? (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-black/5">
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">Facility</th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">Client</th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">Time</th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">Total</th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40">Status</th>
                <th className="p-6 text-[10px] font-mono uppercase text-black/40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-black/5 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="p-6 font-medium">{booking.room_name}</td>
                  <td className="p-6 text-sm">{booking.client_name}</td>
                  <td className="p-6 text-xs font-mono">
                    {new Date(booking.start_time).toLocaleDateString()} <br/>
                    {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                    {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-6 font-serif italic">N$ {booking.total_price}</td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-mono uppercase
                      ${booking.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-700'}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    {isAdmin && (
                      <button 
                        onClick={() => deleteBooking(booking.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {services.map((service) => (
            <div key={service.id} className="bg-white p-4 rounded-xl border border-black/5 shadow-sm flex justify-between items-center group">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-xs text-black/40 font-mono">N$ {service.price}</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => deleteService(service.id)}
                  className="p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isBooking && selectedFacility && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-black/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">Book {selectedFacility.name}</h3>
                <button onClick={() => setIsBooking(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleBooking} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Client Name</label>
                  <input 
                    type="text" 
                    required
                    value={newBooking.client_name}
                    onChange={(e) => setNewBooking({...newBooking, client_name: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Date</label>
                    <input 
                      type="date" 
                      required
                      value={newBooking.date}
                      onChange={(e) => setNewBooking({...newBooking, date: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Start Time</label>
                    <input 
                      type="time" 
                      required
                      value={newBooking.start_time}
                      onChange={(e) => setNewBooking({...newBooking, start_time: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">End Time</label>
                  <input 
                    type="time" 
                    required
                    value={newBooking.end_time}
                    onChange={(e) => setNewBooking({...newBooking, end_time: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-2">Additional Services</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {services.map(service => (
                      <label key={service.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox"
                          checked={newBooking.selectedServices.includes(service.id)}
                          onChange={(e) => {
                            const next = e.target.checked 
                              ? [...newBooking.selectedServices, service.id]
                              : newBooking.selectedServices.filter(id => id !== service.id);
                            setNewBooking({...newBooking, selectedServices: next});
                          }}
                          className="rounded border-black/10 text-black focus:ring-black"
                        />
                        <span className="text-sm">{service.name} (N$ {service.price})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
                  Confirm Booking
                </button>
              </form>
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
                <h3 className="text-xl font-serif italic">Add Conference Facility</h3>
                <button onClick={() => setIsAdding(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddRoom} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Facility Name</label>
                  <input 
                    type="text" 
                    required
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Capacity</label>
                  <input 
                    type="number" 
                    required
                    value={newRoom.capacity}
                    onChange={(e) => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Price per Hour (N$)</label>
                  <input 
                    type="number" 
                    required
                    value={newRoom.price_per_hour}
                    onChange={(e) => setNewRoom({...newRoom, price_per_hour: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
                  Save Facility
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
                <h3 className="text-xl font-serif italic">Add Conference Service</h3>
                <button onClick={() => setIsAddingService(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddService} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Service Name</label>
                  <input 
                    type="text" 
                    required
                    value={newService.name}
                    onChange={(e) => setNewService({...newService, name: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Price (N$)</label>
                  <input 
                    type="number" 
                    required
                    value={newService.price}
                    onChange={(e) => setNewService({...newService, price: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
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

const StaffModule = ({ users }: { users: User[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', username: '', email: '', password: '', role: 'Waiter' as any });

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    let secondaryApp;
    try {
      // 1. Create user in Firebase Auth using a secondary app instance
      // This prevents the current admin from being signed out
      try {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuth');
      } catch (e) {
        secondaryApp = getApp('SecondaryAuth');
      }
      
      const secondaryAuth = getAuth(secondaryApp);
      
      await createUserWithEmailAndPassword(secondaryAuth, newStaff.email, newStaff.password);
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      // 2. Save user details to Firestore
      // Use email as the document ID for easier lookup in security rules
      const { password, ...staffData } = newStaff;
      await setDoc(doc(db, 'users', newStaff.email), {
        ...staffData,
        // We store the password as requested, though in production you'd rely on Firebase Auth
        password: password 
      });

      setIsAdding(false);
      setNewStaff({ name: '', username: '', email: '', password: '', role: 'Waiter' });
      alert('Staff member registered successfully. They can now log in with their email and password.');
    } catch (err: any) {
      console.error('Registration error:', err);
      alert('Failed to register staff: ' + err.message);
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (e) {}
      }
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const deleteStaff = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'users');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif italic">Staff Management</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#141414] text-white rounded-xl shadow-lg shadow-black/10 hover:bg-black/90 transition-all"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">Add Staff</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-black/5">
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">Name</th>
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">Username</th>
              <th className="p-6 text-[10px] font-mono uppercase text-black/40">Role</th>
              <th className="p-6 text-[10px] font-mono uppercase text-black/40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((staff) => (
              <tr key={staff.id} className="border-b border-black/5 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="p-6">
                  <p className="font-medium">{staff.name}</p>
                  <p className="text-[10px] font-mono text-black/30">{staff.email}</p>
                </td>
                <td className="p-6 text-sm font-mono">{staff.username}</td>
                <td className="p-6">
                  <select 
                    value={staff.role}
                    onChange={(e) => updateRole(staff.id, e.target.value)}
                    className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Waiter">Waiter</option>
                    <option value="Barman">Barman</option>
                    <option value="Laundry">Laundry</option>
                  </select>
                </td>
                <td className="p-6 text-right">
                  <button 
                    onClick={() => deleteStaff(staff.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                <h3 className="text-xl font-serif italic">Add New Staff</h3>
                <button onClick={() => setIsAdding(false)} className="text-black/20 hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Username</label>
                  <input 
                    type="text" 
                    required
                    value={newStaff.username}
                    onChange={(e) => setNewStaff({...newStaff, username: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Password</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-black/40 mb-1">Role</label>
                  <select 
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({...newStaff, role: e.target.value as any})}
                    className="w-full p-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Waiter">Waiter</option>
                    <option value="Barman">Barman</option>
                    <option value="Laundry">Laundry</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-medium mt-4">
                  Register Staff
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Developer bypass for initial setup
        if (firebaseUser.email === 'btutu427@gmail.com') {
          setUser({ 
            id: firebaseUser.uid, 
            username: 'developer', 
            name: 'System Developer', 
            role: 'Admin',
            email: firebaseUser.email 
          });
          setAuthReady(true);
          seedData(); // Call seedData for the developer
          return;
        }

        // Check if user is registered in the system
        if (!firebaseUser.email) {
          await signOut(auth);
          setUser(null);
          setAuthReady(true);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.email));

          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Allow login without strict verification for internal staff
            setUser({ id: userDoc.id, ...userData } as User);
          } else {
            // Check if this is the first user ever
            const usersSnap = await getDocs(collection(db, 'users'));
            if (usersSnap.empty) {
              // Bootstrap first admin
              const firstAdmin: User = {
                id: firebaseUser.email,
                username: firebaseUser.email.split('@')[0],
                name: firebaseUser.displayName || 'Initial Admin',
                role: 'Admin',
                email: firebaseUser.email
              };
              await setDoc(doc(db, 'users', firebaseUser.email), firstAdmin);
              setUser(firstAdmin);
              seedData();
            } else {
              // User not registered
              console.error('User not registered in staff list');
              await signOut(auth);
              alert('Access Denied: Your account is not registered in the staff list. Please contact the administrator.');
              setUser(null);
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!user) return;

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'rooms'));

    const unsubMenu = onSnapshot(collection(db, 'menu_items'), (snapshot) => {
      setMenu(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'menu_items'));

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    const unsubLaundry = onSnapshot(collection(db, 'laundry_orders'), (snapshot) => {
      setLaundry(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LaundryOrder)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'laundry_orders'));

    const unsubBookings = onSnapshot(collection(db, 'room_bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'room_bookings'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const unsubConf = onSnapshot(collection(db, 'conference_rooms'), (snapshot) => {
      setConferenceRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'conference_rooms'));

    const unsubLaundryServices = onSnapshot(collection(db, 'laundry_services'), (snapshot) => {
      setLaundryServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'laundry_services'));

    const unsubConfServices = onSnapshot(collection(db, 'conference_services'), (snapshot) => {
      setConferenceServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'conference_services'));

    const unsubConfBookings = onSnapshot(collection(db, 'conference_bookings'), (snapshot) => {
      setConferenceBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'conference_bookings'));

    return () => {
      unsubRooms();
      unsubMenu();
      unsubOrders();
      unsubLaundry();
      unsubBookings();
      unsubUsers();
      unsubConf();
      unsubLaundryServices();
      unsubConfServices();
      unsubConfBookings();
    };
  }, [user]);

  const stats = useMemo(() => {
    return {
      activeGuests: bookings.filter(b => b.status === 'Active').length,
      availableRooms: rooms.filter(r => r.status === 'Available').length,
      pendingLaundry: laundry.filter(l => l.status !== 'Delivered').length,
      totalRevenue: [...bookings, ...orders, ...laundry].reduce((sum, item) => sum + (item.total_price || 0), 0)
    };
  }, [rooms, laundry, bookings, orders]);

  const handleLogout = () => signOut(auth);

  async function seedData() {
    try {
      // Check if rooms exist
      const roomSnap = await getDocs(collection(db, 'rooms'));
      if (roomSnap.empty) {
        const initialRooms = [
          { number: '101', category: 'Single', price: 450, status: 'Available' },
          { number: '102', category: 'Single', price: 450, status: 'Available' },
          { number: '201', category: 'Double', price: 750, status: 'Occupied' },
          { number: '202', category: 'Double', price: 750, status: 'Available' },
          { number: '301', category: 'VIP', price: 1200, status: 'Available' },
        ];
        for (const r of initialRooms) await addDoc(collection(db, 'rooms'), r);

        const initialMenu = [
          { name: 'T-Bone Steak', price: 180, category: 'Main', type: 'Restaurant' },
          { name: 'Grilled Hake', price: 140, category: 'Main', type: 'Restaurant' },
          { name: 'Greek Salad', price: 85, category: 'Starter', type: 'Restaurant' },
          { name: 'Windhoek Lager', price: 35, category: 'Drinks', type: 'Bar' },
          { name: 'Red Wine Glass', price: 55, category: 'Drinks', type: 'Bar' },
        ];
        for (const m of initialMenu) await addDoc(collection(db, 'menu_items'), m);

        // Create admin user doc
        if (auth.currentUser && auth.currentUser.email) {
          await setDoc(doc(db, 'users', auth.currentUser.email), {
            username: 'admin',
            name: 'Administrator',
            role: 'Admin',
            email: auth.currentUser.email
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'initialization');
    }
  }

  if (!authReady) return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-black/10 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40">Initializing System...</p>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Receptionist'] },
    { id: 'rooms', label: 'Rooms', icon: Bed, roles: ['Admin', 'Receptionist'] },
    { id: 'restaurant', label: 'Restaurant', icon: Utensils, roles: ['Admin', 'Receptionist', 'Waiter'] },
    { id: 'bar', label: 'Bar POS', icon: Beer, roles: ['Admin', 'Receptionist', 'Waiter', 'Barman'] },
    { id: 'laundry', label: 'Laundry', icon: WashingMachine, roles: ['Admin', 'Receptionist', 'Laundry'] },
    { id: 'conference', label: 'Conference', icon: Calendar, roles: ['Admin', 'Receptionist'] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: ['Admin'] },
    { id: 'staff', label: 'Staff', icon: Users, roles: ['Admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#E4E3E0] flex">
        {/* Sidebar */}
      <aside className="w-72 bg-[#141414] text-white flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-serif italic mb-1">Pahukeni</h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em]">Pension Hotel</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {filteredMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group
                ${activeTab === item.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-white/40 group-hover:text-white'} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Users size={14} />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium truncate">{user?.name || 'Administrator'}</p>
                <p className="text-[10px] font-mono text-white/30 uppercase">{user?.role || 'Admin'}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-serif italic text-[#141414] capitalize">{activeTab}</h2>
            <p className="text-xs font-mono text-black/40 uppercase tracking-widest mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Action buttons removed as per request */}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <>
                <Dashboard stats={stats} bookings={laundry} />
                {user?.role === 'Admin' && rooms.length === 0 && (
                  <div className="mt-8 p-6 bg-white rounded-2xl border border-dashed border-black/20 text-center">
                    <p className="text-sm text-black/40 mb-4">Database appears empty. Initialize with sample data?</p>
                    <button 
                      onClick={seedData}
                      className="px-6 py-2 bg-black text-white rounded-xl text-xs font-mono uppercase tracking-widest"
                    >
                      Seed Database
                    </button>
                  </div>
                )}
              </>
            )}
            {activeTab === 'rooms' && <RoomsModule rooms={rooms} isAdmin={user?.role === 'Admin'} />}
            {activeTab === 'staff' && <StaffModule users={users} />}
            {(activeTab === 'restaurant' || activeTab === 'bar') && (
              <POSModule type={activeTab === 'restaurant' ? 'Restaurant' : 'Bar'} menu={menu} isAdmin={user?.role === 'Admin'} />
            )}
            {activeTab === 'laundry' && <LaundryModule orders={laundry} services={laundryServices} isAdmin={user?.role === 'Admin'} />}
            {activeTab === 'conference' && <ConferenceModule rooms={conferenceRooms} services={conferenceServices} bookings={conferenceBookings} isAdmin={user?.role === 'Admin'} />}
            {activeTab !== 'dashboard' && activeTab !== 'restaurant' && activeTab !== 'bar' && activeTab !== 'staff' && activeTab !== 'laundry' && activeTab !== 'conference' && activeTab !== 'rooms' && (
              <div className="bg-white p-12 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center text-center">
                <AlertCircle size={48} className="text-black/10 mb-4" />
                <h3 className="text-xl font-serif italic mb-2">{activeTab} Module</h3>
                <p className="text-sm text-black/40 max-w-md">
                  This module is currently being populated with live data. 
                  Please check back shortly or use the Dashboard for an overview.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      </div>
    </ErrorBoundary>
  );
}
