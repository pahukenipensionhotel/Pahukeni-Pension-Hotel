import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import {
  handleFirestoreError,
  OperationType,
} from "../../../shared/validation/inputs";
import type {
  RoomBooking,
  ConferenceBooking,
  HotelExpenditure,
  Room,
  Order,
  LaundryOrder,
} from "../../../shared/types/hotel";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";

const currency = new Intl.NumberFormat("en-NA", {
  style: "currency",
  currency: "NAD",
});

function dateRange(start: Date, end: Date): [number, number] {
  return [startOfDay(start).getTime(), endOfDay(end).getTime()];
}

function inRange(time: number, [lo, hi]: [number, number]) {
  return time >= lo && time <= hi;
}

function toMs(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function fmtDate(iso: string): string {
  return format(parseISO(iso), "dd MMM yyyy");
}

function fmtTime(iso: string): string {
  return format(parseISO(iso), "HH:mm");
}

interface TransactionRow {
  id: string;
  date: string;
  dateMs: number;
  description: string;
  category: string;
  type: "Revenue" | "Expense";
  source: "Room" | "Conference" | "F&B" | "Laundry" | "Expenditure";
  payment_method?: string;
  amount: number;
}

export function ReportsModule({ rooms }: { rooms: Room[]; menu: any[]; user: any }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [conferenceBookings, setConferenceBookings] = useState<ConferenceBooking[]>([]);
  const [expenditures, setExpenditures] = useState<HotelExpenditure[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [laundryOrders, setLaundryOrders] = useState<LaundryOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"report" | "expenditure">("report");

  const [expenseForm, setExpenseForm] = useState({
    date: today,
    category: "Supplies",
    item: "",
    amount: "",
    payment_method: "Cash" as "Cash" | "Card" | "Receipt",
    vendor: "",
    notes: "",
  });

  useEffect(() => {
    const qBookings = query(
      collection(db, "room_bookings"),
      orderBy("check_in", "desc"),
      limit(500),
    );
    const qConfBookings = query(
      collection(db, "conference_bookings"),
      orderBy("start_time", "desc"),
      limit(500),
    );
    const qExpenditures = query(
      collection(db, "expenditures"),
      orderBy("date", "desc"),
      limit(500),
    );
    const qOrders = query(
      collection(db, "orders"),
      orderBy("created_at", "desc"),
      limit(500),
    );
    const qLaundry = query(
      collection(db, "laundry_orders"),
      orderBy("created_at", "desc"),
      limit(500),
    );

    const unsubs = [
      onSnapshot(qBookings, (s) =>
        setBookings(s.docs.map((d) => ({ id: d.id, ...d.data() }) as RoomBooking)),
      ),
      onSnapshot(qConfBookings, (s) =>
        setConferenceBookings(s.docs.map((d) => ({ id: d.id, ...d.data() }) as ConferenceBooking)),
      ),
      onSnapshot(qExpenditures, (s) =>
        setExpenditures(s.docs.map((d) => ({ id: d.id, ...d.data() }) as HotelExpenditure)),
      ),
      onSnapshot(qOrders, (s) =>
        setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
      ),
      onSnapshot(qLaundry, (s) =>
        setLaundryOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }) as LaundryOrder)),
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, []);

  const range = useMemo(() => dateRange(new Date(startDate), new Date(endDate)), [startDate, endDate]);

  const inRangeCheckIns = useMemo(
    () => bookings.filter((b) => inRange(toMs(b.check_in), range)),
    [bookings, range],
  );

  const inRangeCheckOuts = useMemo(
    () => bookings.filter((b) => inRange(toMs(b.check_out), range) && b.status === "Checked Out"),
    [bookings, range],
  );

  const roomRevenue = useMemo(
    () =>
      bookings
        .filter((b) => inRange(toMs(b.created_at || b.check_in), range))
        .reduce((sum, b) => sum + (b.total_price || 0), 0),
    [bookings, range],
  );

  const inRangeConfBookings = useMemo(
    () => conferenceBookings.filter((b) => inRange(toMs(b.created_at || b.start_time), range)),
    [conferenceBookings, range],
  );

  const conferenceRevenue = useMemo(
    () => inRangeConfBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
    [inRangeConfBookings],
  );

  const foodRevenue = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            (o.status === "Completed" || o.status === "Paid") &&
            inRange(toMs(o.created_at), range),
        )
        .reduce((sum, o) => sum + (o.total_price || 0), 0),
    [orders, range],
  );

  const laundryRevenue = useMemo(
    () =>
      laundryOrders
        .filter((l) => l.status === "Delivered" && inRange(toMs(l.created_at), range))
        .reduce((sum, l) => sum + (l.total_price || 0), 0),
    [laundryOrders, range],
  );

  const totalExpenditure = useMemo(
    () =>
      expenditures
        .filter((e) => inRange(toMs(e.date || e.created_at), range))
        .reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenditures, range],
  );

  const totalRevenue = roomRevenue + conferenceRevenue + foodRevenue + laundryRevenue;
  const netRevenue = totalRevenue - totalExpenditure;

  const roomCash = useMemo(
    () =>
      inRangeCheckIns
        .filter((b) => b.payment_method === "Cash")
        .reduce((s, b) => s + (b.total_price || 0), 0),
    [inRangeCheckIns],
  );
  const roomCard = useMemo(
    () =>
      inRangeCheckIns
        .filter((b) => b.payment_method === "Card")
        .reduce((s, b) => s + (b.total_price || 0), 0),
    [inRangeCheckIns],
  );
  const roomReceipt = useMemo(
    () =>
      inRangeCheckIns
        .filter((b) => b.payment_method === "Receipt")
        .reduce((s, b) => s + (b.total_price || 0), 0),
    [inRangeCheckIns],
  );

  const confCash = useMemo(
    () =>
      inRangeConfBookings
        .filter((b) => b.payment_method === "Cash")
        .reduce((s, b) => s + (b.total_price || 0), 0),
    [inRangeConfBookings],
  );
  const confCard = useMemo(
    () =>
      inRangeConfBookings
        .filter((b) => b.payment_method === "Card")
        .reduce((s, b) => s + (b.total_price || 0), 0),
    [inRangeConfBookings],
  );
  const confReceipt = useMemo(
    () =>
      inRangeConfBookings
        .filter((b) => b.payment_method === "Receipt")
        .reduce((s, b) => s + (b.total_price || 0), 0),
    [inRangeConfBookings],
  );

  const cashTotal = roomCash + confCash;
  const cardTotal = roomCard + confCard;
  const receiptTotal = roomReceipt + confReceipt;

  const inRangeExpenditures = useMemo(
    () => expenditures.filter((e) => inRange(toMs(e.date || e.created_at), range)),
    [expenditures, range],
  );

  const inRangeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          (o.status === "Completed" || o.status === "Paid") &&
          inRange(toMs(o.created_at), range),
      ),
    [orders, range],
  );

  const inRangeLaundry = useMemo(
    () =>
      laundryOrders.filter((l) => l.status === "Delivered" && inRange(toMs(l.created_at), range)),
    [laundryOrders, range],
  );

  const transactions = useMemo<TransactionRow[]>(() => {
    const rows: TransactionRow[] = [];

    inRangeCheckIns.forEach((b) => {
      rows.push({
        id: `room-${b.id}`,
        date: b.check_in,
        dateMs: toMs(b.check_in),
        description: `${b.guest_name} — ${b.room_number}`,
        category: "Room Booking",
        type: "Revenue",
        source: "Room",
        payment_method: b.payment_method,
        amount: b.total_price,
      });
    });

    inRangeConfBookings.forEach((b) => {
      rows.push({
        id: `conf-${b.id}`,
        date: b.start_time,
        dateMs: toMs(b.start_time),
        description: `${b.client_name} — ${b.room_name}`,
        category: "Conference Booking",
        type: "Revenue",
        source: "Conference",
        payment_method: b.payment_method,
        amount: b.total_price,
      });
    });

    inRangeOrders.forEach((o) => {
      rows.push({
        id: `order-${o.id}`,
        date: o.created_at,
        dateMs: toMs(o.created_at),
        description: `${o.customer_name || "Guest"} — ${o.items.map((i) => i.name).join(", ")}`,
        category: `${o.type} Order`,
        type: "Revenue",
        source: "F&B",
        payment_method: undefined,
        amount: o.total_price,
      });
    });

    inRangeLaundry.forEach((l) => {
      rows.push({
        id: `laundry-${l.id}`,
        date: l.created_at,
        dateMs: toMs(l.created_at),
        description: `${l.guest_name}${l.room_number ? ` — Room ${l.room_number}` : ""}`,
        category: "Laundry",
        type: "Revenue",
        source: "Laundry",
        payment_method: undefined,
        amount: l.total_price,
      });
    });

    inRangeExpenditures.forEach((e) => {
      rows.push({
        id: `exp-${e.id}`,
        date: e.date || e.created_at,
        dateMs: toMs(e.date || e.created_at),
        description: e.item,
        category: e.category,
        type: "Expense",
        source: "Expenditure",
        payment_method: e.payment_method,
        amount: e.amount,
      });
    });

    rows.sort((a, b) => b.dateMs - a.dateMs);
    return rows;
  }, [inRangeCheckIns, inRangeConfBookings, inRangeOrders, inRangeLaundry, inRangeExpenditures]);

  const addExpenditure = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.item.trim() || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await addDoc(collection(db, "expenditures"), {
        date: new Date(expenseForm.date).toISOString(),
        category: expenseForm.category,
        item: expenseForm.item.trim(),
        amount,
        payment_method: expenseForm.payment_method,
        vendor: expenseForm.vendor.trim(),
        notes: expenseForm.notes.trim(),
        added_by: "Staff",
        created_at: new Date().toISOString(),
      });
      setExpenseForm({
        date: today,
        category: "Supplies",
        item: "",
        amount: "",
        payment_method: "Cash",
        vendor: "",
        notes: "",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "expenditures");
    }
  };

  const downloadCSV = useCallback(() => {
    const safe = (v: unknown) => {
      const s = String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows: string[] = [];
    const push = (...cells: string[]) => rows.push(cells.join(","));

    push("PAHUKENI PENSION HOTEL - FINANCIAL REPORT");
    push(`Period,${safe(startDate)},to,${safe(endDate)}`);
    push(`Generated,${safe(format(new Date(), "yyyy-MM-dd HH:mm"))}`);
    push("");

    push("KEY METRICS");
    push("Metric,Value");
    push("Room Revenue", safe(currency.format(roomRevenue)));
    push("Conference Revenue", safe(currency.format(conferenceRevenue)));
    push("Food & Beverage Revenue", safe(currency.format(foodRevenue)));
    push("Laundry Revenue", safe(currency.format(laundryRevenue)));
    push("Total Revenue", safe(currency.format(totalRevenue)));
    push("Total Expenditure", safe(currency.format(totalExpenditure)));
    push("Net Revenue", safe(currency.format(netRevenue)));
    push(`Check-ins,${inRangeCheckIns.length}`);
    push(`Check-outs,${inRangeCheckOuts.length}`);
    push("");

    push("PAYMENT BREAKDOWN");
    push("Method,Count,Total");
    const cashCount = inRangeCheckIns.filter((b) => b.payment_method === "Cash").length;
    const cardCount = inRangeCheckIns.filter((b) => b.payment_method === "Card").length;
    const receiptCount = inRangeCheckIns.filter((b) => b.payment_method === "Receipt").length;
    push("Cash", String(cashCount), safe(currency.format(cashTotal)));
    push("Card", String(cardCount), safe(currency.format(cardTotal)));
    push("Receipt", String(receiptCount), safe(currency.format(receiptTotal)));
    push("");

    push("TRANSACTION LOG");
    push("Date,Time,Description,Category,Type,Source,Payment,Amount");
    transactions.forEach((t) =>
      push(
        safe(fmtDate(t.date)),
        safe(fmtTime(t.date)),
        safe(t.description),
        safe(t.category),
        t.type,
        t.source,
        safe(t.payment_method || "—"),
        safe(currency.format(t.type === "Expense" ? -t.amount : t.amount)),
      ),
    );
    push("");

    push("ROOM BOOKINGS");
    push("Date,Time,Guest,Room,Check-in,Check-out,Payment,Amount,Status");
    bookings
      .filter((b) => inRange(toMs(b.check_in), range))
      .forEach((b) =>
        push(
          safe(fmtDate(b.created_at || b.check_in)),
          safe(fmtTime(b.created_at || b.check_in)),
          safe(b.guest_name),
          safe(b.room_number),
          safe(fmtDate(b.check_in)),
          safe(fmtDate(b.check_out)),
          safe(b.payment_method),
          safe(currency.format(b.total_price)),
          safe(b.status),
        ),
      );
    push("");

    push("CONFERENCE BOOKINGS");
    push("Date,Time,Client,Room,Start,End,Payment,Amount,Status");
    conferenceBookings
      .filter((b) => inRange(toMs(b.start_time), range))
      .forEach((b) =>
        push(
          safe(fmtDate(b.created_at || b.start_time)),
          safe(fmtTime(b.created_at || b.start_time)),
          safe(b.client_name),
          safe(b.room_name),
          safe(format(parseISO(b.start_time), "yyyy-MM-dd HH:mm")),
          safe(format(parseISO(b.end_time), "yyyy-MM-dd HH:mm")),
          safe(b.payment_method),
          safe(currency.format(b.total_price)),
          safe(b.status),
        ),
      );
    push("");

    push("FOOD & BEVERAGE ORDERS");
    push("Date,Time,Customer,Items,Type,Status,Amount");
    inRangeOrders.forEach((o) =>
      push(
        safe(fmtDate(o.created_at)),
        safe(fmtTime(o.created_at)),
        safe(o.customer_name),
        safe(o.items.map((i) => `${i.name} x${i.qty}`).join("; ")),
        safe(o.type),
        safe(o.status),
        safe(currency.format(o.total_price)),
      ),
    );
    push("");

    push("LAUNDRY ORDERS");
    push("Date,Time,Guest,Room,Items,Status,Amount");
    inRangeLaundry.forEach((l) =>
      push(
        safe(fmtDate(l.created_at)),
        safe(fmtTime(l.created_at)),
        safe(l.guest_name),
        safe(l.room_number),
        safe(l.items.map((i) => `${i.name} x${i.qty}`).join("; ")),
        safe(l.status),
        safe(currency.format(l.total_price)),
      ),
    );
    push("");

    push("EXPENDITURE");
    push("Date,Time,Item,Category,Vendor,Payment,Amount");
    inRangeExpenditures.forEach((e) =>
      push(
        safe(fmtDate(e.date || e.created_at)),
        safe(fmtTime(e.date || e.created_at)),
        safe(e.item),
        safe(e.category),
        safe(e.vendor),
        safe(e.payment_method),
        safe(currency.format(e.amount)),
      ),
    );

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    startDate, endDate, roomRevenue, conferenceRevenue, foodRevenue, laundryRevenue,
    totalRevenue, totalExpenditure, netRevenue, inRangeCheckIns, inRangeCheckOuts,
    cashTotal, cardTotal, receiptTotal, bookings, conferenceBookings,
    inRangeOrders, inRangeLaundry, inRangeExpenditures, transactions, range,
  ]);

  const numSources = [bookings, conferenceBookings, expenditures, orders, laundryOrders].filter(
    (a) => a.length > 0,
  ).length;
  const isLive = numSources >= 2;

  const dateLabel =
    startDate === endDate
      ? format(parseISO(startDate), "EEEE, dd MMMM yyyy")
      : `${format(parseISO(startDate), "dd MMM yyyy")} - ${format(parseISO(endDate), "dd MMM yyyy")}`;

  const revenueTotal = transactions.filter((t) => t.type === "Revenue").reduce((s, t) => s + t.amount, 0);
  const expenseTotal = transactions.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40">
              {dateLabel}
            </p>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[8px] font-mono uppercase tracking-widest border border-emerald-200">
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              Live
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-serif italic text-[#141414]">
            Financial Report
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-xs font-mono"
          />
          <span className="text-[10px] font-mono text-black/30">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2 text-xs font-mono"
          />
          <button
            onClick={downloadCSV}
            className="rounded-xl bg-black px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-white hover:bg-black/90"
          >
            Download CSV
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-xl border border-black/10 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-black/70 hover:bg-black/5"
          >
            Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/5 bg-white p-2">
        <button
          onClick={() => setActiveTab("report")}
          className={`rounded-xl px-4 py-2 text-xs font-mono uppercase tracking-widest ${
            activeTab === "report"
              ? "bg-black text-white"
              : "text-black/50 hover:bg-black/5"
          }`}
        >
          Financial Report
        </button>
        <button
          onClick={() => setActiveTab("expenditure")}
          className={`rounded-xl px-4 py-2 text-xs font-mono uppercase tracking-widest ${
            activeTab === "expenditure"
              ? "bg-black text-white"
              : "text-black/50 hover:bg-black/5"
          }`}
        >
          Add Expenditure
        </button>
      </div>

      {activeTab === "report" ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-black/5 bg-white p-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
                Revenue
              </p>
              <p className="mt-2 text-3xl font-serif italic text-emerald-700">
                {currency.format(totalRevenue)}
              </p>
              <div className="mt-3 space-y-1 text-[10px] font-mono text-black/30">
                <p>Rooms: {currency.format(roomRevenue)}</p>
                <p>Conference: {currency.format(conferenceRevenue)}</p>
                <p>F&B: {currency.format(foodRevenue)}</p>
                <p>Laundry: {currency.format(laundryRevenue)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
                Expenditure
              </p>
              <p className="mt-2 text-3xl font-serif italic text-red-600">
                {currency.format(totalExpenditure)}
              </p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
                Net Revenue
              </p>
              <p className={`mt-2 text-3xl font-serif italic ${netRevenue >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {currency.format(netRevenue)}
              </p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
                Check-ins / Check-outs
              </p>
              <p className="mt-2 text-3xl font-serif italic">
                {inRangeCheckIns.length} / {inRangeCheckOuts.length}
              </p>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="rounded-2xl border border-black/5 bg-white p-6">
            <h3 className="text-sm font-serif italic mb-4">Payment Breakdown</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-5 border border-black/5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">Cash</p>
                <p className="mt-1 text-2xl font-serif italic">{currency.format(cashTotal)}</p>
                <p className="text-[10px] font-mono text-black/30 mt-1">
                  Rooms: {currency.format(roomCash)} / Conference: {currency.format(confCash)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-5 border border-black/5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">Card</p>
                <p className="mt-1 text-2xl font-serif italic">{currency.format(cardTotal)}</p>
                <p className="text-[10px] font-mono text-black/30 mt-1">
                  Rooms: {currency.format(roomCard)} / Conference: {currency.format(confCard)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-5 border border-black/5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">Receipt</p>
                <p className="mt-1 text-2xl font-serif italic">{currency.format(receiptTotal)}</p>
                <p className="text-[10px] font-mono text-black/30 mt-1">
                  Rooms: {currency.format(roomReceipt)} / Conference: {currency.format(confReceipt)}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Log — individual items with date, time, amount */}
          <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
            <div className="p-6 border-b border-black/5 flex items-center justify-between">
              <h3 className="text-sm font-serif italic">
                Transaction Log ({transactions.length} entries)
              </h3>
              <div className="flex gap-4 text-[10px] font-mono text-black/30">
                <span>Revenue: <span className="text-emerald-600 font-bold">{currency.format(revenueTotal)}</span></span>
                <span>Expenses: <span className="text-red-600 font-bold">{currency.format(expenseTotal)}</span></span>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[10px] font-mono uppercase text-black/40 sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-black/40">
                        No transactions in this period
                      </td>
                    </tr>
                  )}
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="p-3 font-mono text-[11px] text-black/50 whitespace-nowrap">{fmtTime(t.date)}</td>
                      <td className="p-3 font-medium">{t.description}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                          t.source === "Expenditure"
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}>
                          {t.source}
                        </span>
                      </td>
                      <td className="p-3 text-[10px] font-mono text-black/40 uppercase">
                        {t.payment_method || "—"}
                      </td>
                      <td className={`p-3 text-right font-mono text-sm font-bold ${
                        t.type === "Expense" ? "text-red-600" : "text-emerald-700"
                      }`}>
                        {t.type === "Expense" ? "-" : "+"}{currency.format(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Room Check-ins Table */}
          <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-sm font-serif italic">
                Room Bookings ({inRangeCheckIns.length}) — {currency.format(roomRevenue)}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[10px] font-mono uppercase text-black/40">
                  <tr>
                    <th className="p-4">Date / Time</th>
                    <th className="p-4">Guest</th>
                    <th className="p-4">Room</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {inRangeCheckIns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-black/40">
                        No room bookings in this period
                      </td>
                    </tr>
                  )}
                  {inRangeCheckIns.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="p-4 font-mono text-[11px] whitespace-nowrap">
                        {fmtDate(b.created_at || b.check_in)}<br />
                        <span className="text-black/40">{fmtTime(b.created_at || b.check_in)}</span>
                      </td>
                      <td className="p-4 font-medium">{b.guest_name}</td>
                      <td className="p-4">{b.room_number}</td>
                      <td className="p-4">
                        <span className="text-[10px] font-mono uppercase">
                          {b.payment_method || "N/A"}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-700 font-bold">
                        +{currency.format(b.total_price)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase ${
                            b.status === "Checked In"
                              ? "bg-emerald-50 text-emerald-700"
                              : b.status === "Checked Out"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conference Bookings Table */}
          {inRangeConfBookings.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
              <div className="p-6 border-b border-black/5">
                <h3 className="text-sm font-serif italic">
                  Conference Bookings ({inRangeConfBookings.length}) — {currency.format(conferenceRevenue)}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] font-mono uppercase text-black/40">
                    <tr>
                      <th className="p-4">Date / Time</th>
                      <th className="p-4">Client</th>
                      <th className="p-4">Facility</th>
                      <th className="p-4">Payment</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {inRangeConfBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="p-4 font-mono text-[11px] whitespace-nowrap">
                          {fmtDate(b.created_at || b.start_time)}<br />
                          <span className="text-black/40">{fmtTime(b.created_at || b.start_time)}</span>
                        </td>
                        <td className="p-4 font-medium">{b.client_name}</td>
                        <td className="p-4">{b.room_name}</td>
                        <td className="p-4">
                          <span className="text-[10px] font-mono uppercase">
                            {b.payment_method || "N/A"}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono text-emerald-700 font-bold">
                          +{currency.format(b.total_price)}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-mono uppercase text-black/40">
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* F&B Orders Table */}
          {inRangeOrders.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
              <div className="p-6 border-b border-black/5">
                <h3 className="text-sm font-serif italic">
                  Food & Beverage Orders ({inRangeOrders.length}) — {currency.format(foodRevenue)}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] font-mono uppercase text-black/40">
                    <tr>
                      <th className="p-4">Date / Time</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Items</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {inRangeOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="p-4 font-mono text-[11px] whitespace-nowrap">
                          {fmtDate(o.created_at)}<br />
                          <span className="text-black/40">{fmtTime(o.created_at)}</span>
                        </td>
                        <td className="p-4 font-medium">{o.customer_name || "—"}</td>
                        <td className="p-4 text-black/60 text-xs">
                          {o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-mono uppercase">{o.type}</span>
                        </td>
                        <td className="p-4 text-right font-mono text-emerald-700 font-bold">
                          +{currency.format(o.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Laundry Orders Table */}
          {inRangeLaundry.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
              <div className="p-6 border-b border-black/5">
                <h3 className="text-sm font-serif italic">
                  Laundry Orders ({inRangeLaundry.length}) — {currency.format(laundryRevenue)}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] font-mono uppercase text-black/40">
                    <tr>
                      <th className="p-4">Date / Time</th>
                      <th className="p-4">Guest</th>
                      <th className="p-4">Room</th>
                      <th className="p-4">Items</th>
                      <th className="p-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {inRangeLaundry.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="p-4 font-mono text-[11px] whitespace-nowrap">
                          {fmtDate(l.created_at)}<br />
                          <span className="text-black/40">{fmtTime(l.created_at)}</span>
                        </td>
                        <td className="p-4 font-medium">{l.guest_name}</td>
                        <td className="p-4">{l.room_number || "—"}</td>
                        <td className="p-4 text-black/60 text-xs">
                          {l.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                        </td>
                        <td className="p-4 text-right font-mono text-emerald-700 font-bold">
                          +{currency.format(l.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expenditure Table */}
          {inRangeExpenditures.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
              <div className="p-6 border-b border-black/5">
                <h3 className="text-sm font-serif italic">
                  Expenditure ({inRangeExpenditures.length}) — {currency.format(totalExpenditure)}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] font-mono uppercase text-black/40">
                    <tr>
                      <th className="p-4">Date / Time</th>
                      <th className="p-4">Item</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Payment</th>
                      <th className="p-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {inRangeExpenditures.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="p-4 font-mono text-[11px] whitespace-nowrap">
                          {fmtDate(e.date || e.created_at)}<br />
                          <span className="text-black/40">{fmtTime(e.date || e.created_at)}</span>
                        </td>
                        <td className="p-4">{e.item}</td>
                        <td className="p-4 text-black/60">{e.category}</td>
                        <td className="p-4">
                          <span className="text-[10px] font-mono uppercase">
                            {e.payment_method}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono text-red-600 font-bold">
                          -{currency.format(e.amount)}
                        </td>
                      </tr>
                    ))}
                    {inRangeExpenditures.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-black/40">
                          No expenditure in this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <form
          onSubmit={addExpenditure}
          className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
        >
          <h3 className="text-sm font-serif italic mb-6">Record Expenditure</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              required
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              required
              type="text"
              placeholder="Expense item"
              value={expenseForm.item}
              onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })}
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount (N$)"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Category (e.g. Fuel, Repairs)"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <select
              value={expenseForm.payment_method}
              onChange={(e) =>
                setExpenseForm({ ...expenseForm, payment_method: e.target.value as any })
              }
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Receipt">Receipt</option>
            </select>
            <input
              type="text"
              placeholder="Vendor / Supplier"
              value={expenseForm.vendor}
              onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Notes (optional)"
            value={expenseForm.notes}
            onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            className="mt-4 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            rows={2}
          />
          <button
            type="submit"
            className="mt-4 rounded-xl bg-black px-6 py-3 text-xs font-mono uppercase tracking-widest text-white hover:bg-black/90"
          >
            Save Expenditure
          </button>
        </form>
      )}
    </div>
  );
}
