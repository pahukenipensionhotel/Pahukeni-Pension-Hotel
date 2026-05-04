import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
} from "lucide-react";
import type {
  ConferenceBooking,
  HotelExpenditure,
  LaundryOrder,
  MenuItem,
  Order,
  Room,
  RoomBooking,
  Folio,
  User,
} from "../../../shared/types/hotel";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../../services/firebase/client";
import {
  handleFirestoreError,
  OperationType,
} from "../../../shared/validation/inputs";

type ReportType =
  | "all"
  | "revenue"
  | "orders"
  | "rooms"
  | "laundry"
  | "conference"
  | "inventory"
  | "folio_logs"
  | "non_room_revenue"
  | "manual_24h";

type SortKey = "date" | "category" | "guest" | "status" | "amount";
type SortDirection = "asc" | "desc";

type ReportRow = {
  id: string;
  category: string;
  reference: string;
  guest: string;
  status: string;
  date: string;
  amount: number;
  details: string;
  // helpful metadata for ledger rendering
  source?: string;
  meta?: Record<string, any>;
};

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "all", label: "All Activity" },
  { value: "revenue", label: "Revenue" },
  { value: "orders", label: "Food & Bar Orders" },
  { value: "rooms", label: "Room Bookings" },
  { value: "laundry", label: "Laundry" },
  { value: "conference", label: "Conference" },
  { value: "inventory", label: "Inventory" },
  { value: "folio_logs", label: "Bar/Restaurant Audit Log" },
  { value: "non_room_revenue", label: "Manual Folio Charges (Range)" },
  { value: "manual_24h", label: "Manual Charges (Last 24 Hours)" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "category", label: "Category" },
  { value: "guest", label: "Guest" },
  { value: "status", label: "Status" },
  { value: "amount", label: "Amount" },
];

const currency = new Intl.NumberFormat("en-NA", {
  style: "currency",
  currency: "NAD",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString("en-NA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`).getTime();
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeText(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function downloadBlob(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function wrapPdfText(value: string, maxLength: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function escapePdfText(value: string | number) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function buildPdfDocument({
  rows,
  title,
  startDate,
  endDate,
  totalRevenue,
  generatedAt,
}: {
  rows: ReportRow[];
  title: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  generatedAt: string;
}) {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 36;
  const lineHeight = 13;
  const maxRows = 26;
  const dateRange =
    startDate || endDate
      ? `${startDate || "Beginning"} to ${endDate || "Today"}`
      : "All available dates";
  const reportRows = rows.length ? rows : [];
  const pages = Math.max(1, Math.ceil(reportRows.length / maxRows));
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  const fontBoldId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );
  const pageIds: number[] = [];

  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const pageRows = reportRows.slice(
      pageIndex * maxRows,
      (pageIndex + 1) * maxRows,
    );
    const stream: string[] = [
      "0.95 0.95 0.92 rg",
      `0 0 ${pageWidth} ${pageHeight} re f`,
      "0.08 0.08 0.08 rg",
      `0 ${pageHeight - 86} ${pageWidth} 86 re f`,
      "1 1 1 rg",
      "BT /F2 18 Tf",
      `${margin} ${pageHeight - 38} Td (${escapePdfText(`Pahukeni Pension Hotel - ${title}`)}) Tj`,
      "ET",
      "BT /F1 9 Tf",
      `${margin} ${pageHeight - 58} Td (${escapePdfText(`Generated: ${generatedAt} | Date range: ${dateRange} | Page ${pageIndex + 1} of ${pages}`)}) Tj`,
      "ET",
      "0.89 0.97 0.93 rg",
      `${margin} ${pageHeight - 122} 230 24 re f`,
      "0.92 0.95 1 rg",
      `${margin + 244} ${pageHeight - 122} 230 24 re f`,
      "0.98 0.92 0.92 rg",
      `${margin + 488} ${pageHeight - 122} 230 24 re f`,
      "0 0 0 rg",
      "BT /F2 10 Tf",
      `${margin + 10} ${pageHeight - 114} Td (${escapePdfText(`Records: ${rows.length}`)}) Tj`,
      "ET",
      "BT /F2 10 Tf",
      `${margin + 254} ${pageHeight - 114} Td (${escapePdfText(`Report Value: ${currency.format(totalRevenue)}`)}) Tj`,
      "ET",
      "BT /F2 10 Tf",
      `${margin + 498} ${pageHeight - 114} Td (${escapePdfText(`Rows on Page: ${pageRows.length}`)}) Tj`,
      "ET",
      "0.12 0.16 0.22 rg",
      `${margin} ${pageHeight - 160} ${pageWidth - margin * 2} 22 re f`,
      "1 1 1 rg",
      "BT /F2 8 Tf",
      `${margin + 8} ${pageHeight - 153} Td (Category) Tj`,
      `${118} 0 Td (Reference) Tj`,
      `${92} 0 Td (Guest / Source) Tj`,
      `${150} 0 Td (Status) Tj`,
      `${84} 0 Td (Date) Tj`,
      `${112} 0 Td (Amount) Tj`,
      "ET",
    ];

    if (pageRows.length === 0) {
      stream.push(
        "0 0 0 rg",
        "BT /F1 11 Tf",
        `${margin + 8} ${pageHeight - 190} Td (No records matched this report filter.) Tj`,
        "ET",
      );
    }

    pageRows.forEach((row, rowIndex) => {
      const y = pageHeight - 184 - rowIndex * lineHeight;
      if (rowIndex % 2 === 0) {
        stream.push(
          "1 1 1 rg",
          `${margin} ${y - 3} ${pageWidth - margin * 2} ${lineHeight} re f`,
        );
      }
      const guestLines = wrapPdfText(row.guest, 24);
      stream.push(
        "0 0 0 rg",
        "BT /F1 7 Tf",
        `${margin + 8} ${y} Td (${escapePdfText(row.category)}) Tj`,
        `${118} 0 Td (${escapePdfText(row.reference)}) Tj`,
        `${92} 0 Td (${escapePdfText(guestLines[0])}) Tj`,
        `${150} 0 Td (${escapePdfText(row.status)}) Tj`,
        `${84} 0 Td (${escapePdfText(formatDate(row.date))}) Tj`,
        `${112} 0 Td (${escapePdfText(row.amount.toFixed(2))}) Tj`,
        "ET",
      );
    });

    const streamContent = stream.join("\n");
    const streamId = addObject(
      `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent __PAGES__  /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  const pagesId = addObject(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const resolvedObjects = objects.map((object) =>
    object.replace(/__PAGES__/g, `${pagesId} 0 R`),
  );
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  resolvedObjects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${resolvedObjects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${resolvedObjects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function buildReportRows({
  orders,
  laundry,
  bookings,
  conferenceBookings,
  rooms,
  menu,
  folios = [],
  expenditures = [],
}: {
  orders: Order[];
  laundry: LaundryOrder[];
  bookings: RoomBooking[];
  conferenceBookings: ConferenceBooking[];
  rooms: Room[];
  menu: MenuItem[];
  folios?: Folio[];
  expenditures?: HotelExpenditure[];
}): ReportRow[] {
  const orderRows = orders.map((order) => ({
    id: `order-${order.id}`,
    category: `${order.type} Order`,
    reference: normalizeText(order.table_number, order.id.slice(0, 8)),
    guest: normalizeText(
      order.customer_name || order.customer_email,
      "Walk-in",
    ),
    status: normalizeText(order.status, "Unknown"),
    date: normalizeText(order.created_at, new Date().toISOString()),
    amount: order.total_price || 0,
    details: order.items.map((item) => `${item.name} x ${item.qty}`).join(", "),
    source: "order",
    meta: {
      items: order.items,
      table_number: order.table_number,
      customer_uid: order.customer_uid,
    },
  }));

  const laundryRows = laundry.map((order) => ({
    id: `laundry-${order.id}`,
    category: "Laundry",
    reference: normalizeText(order.room_number, order.id.slice(0, 8)),
    guest: normalizeText(order.guest_name || order.customer_email, "Guest"),
    status: normalizeText(order.status, "Unknown"),
    date: normalizeText(order.created_at, new Date().toISOString()),
    amount: order.total_price || 0,
    details: order.items.map((item) => `${item.name} x ${item.qty}`).join(", "),
    source: "laundry",
    meta: {
      items: order.items,
      room_number: order.room_number,
    },
  }));

  const roomRows = bookings.map((booking) => ({
    id: `room-${booking.id}`,
    category: "Room Booking",
    reference: normalizeText(booking.room_number, booking.id.slice(0, 8)),
    guest: normalizeText(booking.guest_name || booking.guest_email, "Guest"),
    status: normalizeText(booking.status, "Unknown"),
    date: normalizeText(
      booking.created_at || booking.check_in,
      new Date().toISOString(),
    ),
    amount: booking.total_price || 0,
    details: `Check-in: ${formatDate(booking.check_in)} | Check-out: ${formatDate(booking.check_out)} | Payment: ${booking.payment_method || "N/A"} | Source: ${booking.source || "N/A"}`,
    source: "room",
    meta: {
      check_in: booking.check_in,
      check_out: booking.check_out,
      payment_method: booking.payment_method,
      booking_id: booking.id,
    },
  }));

  const conferenceRows = conferenceBookings.map((booking) => ({
    id: `conference-${booking.id}`,
    category: "Conference",
    reference: normalizeText(booking.room_id, booking.id.slice(0, 8)),
    guest: normalizeText(booking.client_name, "Client"),
    status: normalizeText(booking.status, "Unknown"),
    date: normalizeText(
      booking.created_at || booking.start_time,
      new Date().toISOString(),
    ),
    amount: booking.total_price || 0,
    details: `Start: ${formatDate(booking.start_time)} | End: ${formatDate(booking.end_time)}`,
    source: "conference",
    meta: {
      start_time: booking.start_time,
      end_time: booking.end_time,
    },
  }));

  const inventoryRows = menu.map((item) => ({
    id: `inventory-${item.id}`,
    category: "Inventory",
    reference: item.type,
    guest: "Stock",
    status: normalizeText(item.status, "Unknown"),
    date: new Date().toISOString(),
    amount: (item.stock || 0) * (item.costPrice || 0),
    details: `${item.name} | Stock: ${item.stock || 0} | Min: ${item.minStock || 0} | Unit cost: ${currency.format(item.costPrice || 0)}`,
    source: "inventory",
    meta: {
      stock: item.stock,
      costPrice: item.costPrice,
    },
  }));

  const roomInventoryRows = rooms.map((room) => ({
    id: `room-inventory-${room.id}`,
    category: "Room Inventory",
    reference: normalizeText(room.number, room.id.slice(0, 8)),
    guest: normalizeText(room.category, "Room"),
    status: normalizeText(room.status, "Unknown"),
    date: new Date().toISOString(),
    amount: room.price || 0,
    details: room.description || "Room status record",
    source: "room_inventory",
    meta: { category: room.category },
  }));

  const folioRows = folios.flatMap((folio) => {
    const booking = bookings.find((b) => b.id === folio.booking_id);
    return folio.charges.map((charge) => ({
      id: `folio-${charge.id}`,
      category: `Folio: ${charge.category}`,
      reference: normalizeText(charge.reference, booking?.room_number || "N/A"),
      guest: normalizeText(booking?.guest_name, "Guest"),
      status: "Posted",
      date: charge.date,
      amount: charge.amount,
      details: `${charge.description} | Posted by: ${charge.staff_name || "Staff"}`,
      source: "folio",
      meta: {
        staff_name: charge.staff_name,
        folio_id: folio.id,
      },
    }));
  });

  const expenditureRows = expenditures.map((expense) => ({
    id: `expense-${expense.id}`,
    category: "Expenditure",
    reference: normalizeText(expense.category, "Expense"),
    guest: normalizeText(expense.vendor || expense.added_by, "Hotel Ops"),
    status: normalizeText(expense.payment_method, "Paid"),
    date: normalizeText(
      expense.date || expense.created_at,
      new Date().toISOString(),
    ),
    amount: -(expense.amount || 0),
    details: `${expense.item} | ${expense.notes || "No notes"}`,
    source: "expenditure",
    meta: {
      item: expense.item,
      vendor: expense.vendor,
      payment_method: expense.payment_method,
      notes: expense.notes,
      added_by: expense.added_by,
    },
  }));

  return [
    ...orderRows,
    ...laundryRows,
    ...roomRows,
    ...conferenceRows,
    ...inventoryRows,
    ...roomInventoryRows,
    ...folioRows,
    ...expenditureRows,
  ];
}

function getReportTitle(reportType: ReportType) {
  return (
    REPORT_TYPES.find((type) => type.value === reportType)?.label || "Report"
  );
}

function buildStyledReportHtml({
  rows,
  title,
  startDate,
  endDate,
  totalRevenue,
  generatedAt,
}: {
  rows: ReportRow[];
  title: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  generatedAt: string;
}) {
  const dateRange =
    startDate || endDate
      ? `${startDate || "Beginning"} to ${endDate || "Today"}`
      : "All available dates";

  const tableRows = rows
    .map(
      (row, index) => `
        <tr class="${index % 2 === 0 ? "even" : "odd"}">
          <td>${index + 1}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.reference)}</td>
          <td>${escapeHtml(row.guest)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(formatDate(row.date))}</td>
          <td class="amount">${escapeHtml(row.amount.toFixed(2))}</td>
          <td>${escapeHtml(row.details)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #141414; margin: 28px; }
    .header { background: #141414; color: #ffffff; padding: 22px; border-radius: 10px 10px 0 0; }
    .title { font-size: 24px; font-weight: 700; margin: 0 0 6px; }
    .meta { font-size: 12px; opacity: 0.78; margin: 0; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 18px 0; }
    .card { border: 1px solid #e4e3e0; background: #f7f7f4; padding: 12px; border-radius: 8px; }
    .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th { background: #1f2937; color: #ffffff; padding: 10px; text-align: left; border: 1px solid #111827; }
    td { padding: 9px; border: 1px solid #d7d7d2; vertical-align: top; }
    tr.even td { background: #ffffff; }
    tr.odd td { background: #f5f5f0; }
    .amount { text-align: right; font-weight: 700; color: #047857; }
    @media print {
      body { margin: 12mm; }
      .header { border-radius: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="title">Pahukeni Pension Hotel - ${escapeHtml(title)}</p>
    <p class="meta">Generated ${escapeHtml(generatedAt)} | Date range: ${escapeHtml(dateRange)}</p>
  </div>
  <div class="summary">
    <div class="card"><div class="label">Records</div><div class="value">${rows.length}</div></div>
    <div class="card"><div class="label">Report Value</div><div class="value">${escapeHtml(currency.format(totalRevenue))}</div></div>
    <div class="card"><div class="label">Format</div><div class="value">Live Data</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Category</th>
        <th>Reference</th>
        <th>Guest / Source</th>
        <th>Status</th>
        <th>Date</th>
        <th>Amount NAD</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>${tableRows || '<tr><td colspan="8">No records matched this report filter.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export function ReportsModule({
  orders,
  laundry,
  bookings,
  conferenceBookings,
  rooms,
  menu,
  folios = [],
  expenditures = [],
  user,
}: {
  orders: Order[];
  laundry: LaundryOrder[];
  bookings: RoomBooking[];
  conferenceBookings: ConferenceBooking[];
  rooms: Room[];
  menu: MenuItem[];
  folios?: Folio[];
  expenditures?: HotelExpenditure[];
  user: User;
}) {
  const [activeFinanceTab, setActiveFinanceTab] = useState<
    "income" | "expenditure"
  >("income");
  const [reportType, setReportType] = useState<ReportType>("all");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toInputDate(date);
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showLedger, setShowLedger] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    date: toInputDate(new Date()),
    category: "Supplies",
    item: "",
    amount: "",
    payment_method: "Cash" as "Cash" | "Card",
    vendor: "",
    notes: "",
  });

  const allRows = useMemo(
    () =>
      buildReportRows({
        orders,
        laundry,
        bookings,
        conferenceBookings,
        rooms,
        menu,
        folios,
        expenditures,
      }),
    [
      orders,
      laundry,
      bookings,
      conferenceBookings,
      rooms,
      menu,
      folios,
      expenditures,
    ],
  );

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allRows
            .map((row) => normalizeText(row.status, "Unknown"))
            .filter((status) => status !== "all"),
        ),
      ).sort(),
    [allRows],
  );

  const filteredRows = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    const start = startDate ? startOfDay(startDate) : null;
    const end = endDate ? endOfDay(endDate) : null;

    const selected = allRows.filter((row) => {
      const rowTime = new Date(row.date).getTime();
      const isFolioCharge = row.category.startsWith("Folio:");
      const now = Date.now();
      const matchesType =
        reportType === "all" ||
        (reportType === "revenue" && row.amount > 0) ||
        (reportType === "orders" && row.category.includes("Order")) ||
        (reportType === "rooms" && row.category.includes("Room")) ||
        (reportType === "laundry" && row.category === "Laundry") ||
        (reportType === "conference" && row.category === "Conference") ||
        (reportType === "inventory" && row.category.includes("Inventory")) ||
        (reportType === "folio_logs" && row.category.startsWith("Folio:")) ||
        (reportType === "non_room_revenue" && isFolioCharge) ||
        (reportType === "manual_24h" &&
          isFolioCharge &&
          !Number.isNaN(rowTime) &&
          rowTime >= now - 24 * 60 * 60 * 1000 &&
          rowTime <= now);
      const matchesDate =
        reportType === "manual_24h" ||
        Number.isNaN(rowTime) ||
        ((start === null || rowTime >= start) &&
          (end === null || rowTime <= end));
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      const matchesSearch =
        !lowerSearch ||
        [row.category, row.reference, row.guest, row.status, row.details]
          .join(" ")
          .toLowerCase()
          .includes(lowerSearch);
      return matchesType && matchesDate && matchesStatus && matchesSearch;
    });

    return [...selected].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "amount") return (a.amount - b.amount) * direction;
      if (sortKey === "date") {
        return (
          (new Date(a.date).getTime() - new Date(b.date).getTime()) * direction
        );
      }
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * direction;
    });
  }, [
    allRows,
    endDate,
    reportType,
    searchTerm,
    sortDirection,
    sortKey,
    startDate,
    statusFilter,
  ]);

  const totalRevenue = filteredRows.reduce((sum, row) => sum + row.amount, 0);
  const completedRevenue = filteredRows
    .filter(
      (row) =>
        !["Cancelled", "Out of Stock", "Maintenance"].includes(row.status),
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const pendingCount = filteredRows.filter((row) =>
    ["Pending", "Received", "In Progress", "Booked"].includes(row.status),
  ).length;

  const incomeRows = filteredRows.filter((row) => row.amount > 0);
  const expenseRows = filteredRows.filter((row) => row.amount < 0);
  const totalIncome = incomeRows.reduce((sum, row) => sum + row.amount, 0);
  const totalExpenditure = expenseRows.reduce(
    (sum, row) => sum + Math.abs(row.amount),
    0,
  );
  const netOperating = totalIncome - totalExpenditure;
  const cardIncome = bookings
    .filter((b) => b.payment_method === "Card")
    .reduce((sum, b) => sum + (b.total_price || 0), 0);
  const cashIncome = bookings
    .filter((b) => b.payment_method === "Cash")
    .reduce((sum, b) => sum + (b.total_price || 0), 0);

  const addExpenditure = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.item.trim() || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    try {
      await addDoc(collection(db, "expenditures"), {
        date: new Date(expenseForm.date).toISOString(),
        category: expenseForm.category,
        item: expenseForm.item.trim(),
        amount,
        payment_method: expenseForm.payment_method,
        vendor: expenseForm.vendor.trim(),
        notes: expenseForm.notes.trim(),
        added_by: user.name,
        created_at: new Date().toISOString(),
      });
      setExpenseForm({
        date: toInputDate(new Date()),
        category: "Supplies",
        item: "",
        amount: "",
        payment_method: "Cash",
        vendor: "",
        notes: "",
      });
      // stay on expenditure so the user can immediately see the ledger / list
      setActiveFinanceTab("expenditure");
      setShowLedger(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "expenditures");
    }
  };

  const exportTitle = getReportTitle(reportType);
  const generatedAt = new Date().toLocaleString("en-NA");

  const exportExcel = () => {
    const html = buildStyledReportHtml({
      rows: filteredRows,
      title: exportTitle,
      startDate,
      endDate,
      totalRevenue,
      generatedAt,
    });
    downloadBlob(
      html,
      `pahukeni-${reportType}-report-${toInputDate(new Date())}.xls`,
      "application/vnd.ms-excel;charset=utf-8",
    );
  };

  const exportPdf = () => {
    const pdf = buildPdfDocument({
      rows: filteredRows,
      title: exportTitle,
      startDate,
      endDate,
      totalRevenue,
      generatedAt,
    });
    downloadBlob(
      pdf,
      `pahukeni-${reportType}-report-${toInputDate(new Date())}.pdf`,
      "application/pdf",
    );
  };

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  };

  // Build a ledger view by merging income and expense rows and computing a running balance
  const ledgerEntries = useMemo(() => {
    // Map rows to a unified ledger entry
    const entries = filteredRows.map((row) => {
      const time = Number.isNaN(new Date(row.date).getTime())
        ? Date.now()
        : new Date(row.date).getTime();
      return {
        id: row.id,
        date: time,
        dateStr: formatDate(row.date),
        category: row.category,
        description: row.details || `${row.category} - ${row.reference}`,
        party: row.guest,
        payment_method: row.meta?.payment_method || row.status || "N/A",
        income: row.amount > 0 ? row.amount : 0,
        expense: row.amount < 0 ? Math.abs(row.amount) : 0,
      };
    });

    // sort ascending by date for running balance
    entries.sort((a, b) => a.date - b.date);

    // compute running balance
    let balance = 0;
    return entries.map((e) => {
      balance = balance + (e.income || 0) - (e.expense || 0);
      return { ...e, balance };
    });
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/40">
            Live reporting
          </p>
          <h2 className="mt-2 text-2xl font-serif italic text-[#141414]">
            Reports
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-mono uppercase tracking-widest text-white hover:bg-emerald-700"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button
            onClick={exportPdf}
            className="flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-xs font-mono uppercase tracking-widest text-white hover:bg-black/90"
          >
            <Download size={16} />
            PDF
          </button>
          <button
            onClick={() => setShowLedger((s) => !s)}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-mono uppercase tracking-widest ${showLedger ? "bg-black text-white" : "text-black/50 hover:bg-black/5"}`}
            title="Toggle Ledger View"
          >
            <FileText size={16} />
            Ledger
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/5 bg-white p-2">
        <button
          onClick={() => setActiveFinanceTab("income")}
          className={`rounded-xl px-4 py-2 text-xs font-mono uppercase tracking-widest ${
            activeFinanceTab === "income"
              ? "bg-black text-white"
              : "text-black/50 hover:bg-black/5"
          }`}
        >
          Income Reports
        </button>
        <button
          onClick={() => setActiveFinanceTab("expenditure")}
          className={`rounded-xl px-4 py-2 text-xs font-mono uppercase tracking-widest ${
            activeFinanceTab === "expenditure"
              ? "bg-black text-white"
              : "text-black/50 hover:bg-black/5"
          }`}
        >
          Add Expenditure
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
            Cash Income
          </p>
          <p className="mt-2 text-xl font-serif italic">
            {currency.format(cashIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
            Card Income
          </p>
          <p className="mt-2 text-xl font-serif italic">
            {currency.format(cardIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
            Expenditure
          </p>
          <p className="mt-2 text-xl font-serif italic text-red-600">
            {currency.format(totalExpenditure)}
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
            Net Operating
          </p>
          <p className="mt-2 text-xl font-serif italic">
            {currency.format(netOperating)}
          </p>
        </div>
      </div>

      {activeFinanceTab === "expenditure" && (
        <form
          onSubmit={addExpenditure}
          className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              required
              type="date"
              value={expenseForm.date}
              onChange={(event) =>
                setExpenseForm({ ...expenseForm, date: event.target.value })
              }
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              required
              type="text"
              placeholder="Expense item"
              value={expenseForm.item}
              onChange={(event) =>
                setExpenseForm({ ...expenseForm, item: event.target.value })
              }
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount (N$)"
              value={expenseForm.amount}
              onChange={(event) =>
                setExpenseForm({ ...expenseForm, amount: event.target.value })
              }
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Category (e.g. Fuel, Repairs)"
              value={expenseForm.category}
              onChange={(event) =>
                setExpenseForm({ ...expenseForm, category: event.target.value })
              }
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <select
              value={expenseForm.payment_method}
              onChange={(event) =>
                setExpenseForm({
                  ...expenseForm,
                  payment_method: event.target.value as "Cash" | "Card",
                })
              }
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
            </select>
            <input
              type="text"
              placeholder="Vendor / Supplier"
              value={expenseForm.vendor}
              onChange={(event) =>
                setExpenseForm({ ...expenseForm, vendor: event.target.value })
              }
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Notes"
            value={expenseForm.notes}
            onChange={(event) =>
              setExpenseForm({ ...expenseForm, notes: event.target.value })
            }
            className="mt-4 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="mt-4 rounded-xl bg-black px-5 py-3 text-xs font-mono uppercase tracking-widest text-white"
          >
            Save Expenditure
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
            Records
          </p>
          <p className="mt-2 text-2xl font-serif italic">
            {filteredRows.length}
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
            Report Value
          </p>
          <p className="mt-2 text-2xl font-serif italic">
            {currency.format(totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-black/40">
            Active / Pending
          </p>
          <p className="mt-2 text-2xl font-serif italic">{pendingCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Filter size={16} />
          Filters
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">
              Report
            </span>
            <select
              value={reportType}
              onChange={(event) =>
                setReportType(event.target.value as ReportType)
              }
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">
              From
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">
              To
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status, index) => (
                <option key={`${status}-${index}`} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">
              Sort
            </span>
            <div className="flex gap-2">
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={toggleSortDirection}
                className="rounded-xl border border-black/10 px-3 text-black/60 hover:bg-black/5"
                title={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
              >
                <ArrowUpDown size={16} />
              </button>
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">
              Search
            </span>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
              />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Guest, ref, item..."
                className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>
        </div>
      </div>

      {showLedger ? (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/5 p-5">
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <h3 className="font-medium">General Ledger</h3>
            </div>
            <p className="text-xs font-mono text-black/40">
              Balance:{" "}
              {currency.format(
                ledgerEntries.length
                  ? ledgerEntries[ledgerEntries.length - 1].balance
                  : 0,
              )}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#141414] text-white">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Description
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Category
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Vendor / Guest
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Payment Method
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">
                    Income
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">
                    Expense
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-black/60">{entry.dateStr}</td>
                    <td className="px-4 py-3 max-w-xl text-xs text-black/60">
                      {entry.description}
                    </td>
                    <td className="px-4 py-3">{entry.category}</td>
                    <td className="px-4 py-3">{entry.party}</td>
                    <td className="px-4 py-3 text-black/60">
                      {entry.payment_method}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {currency.format(entry.income)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-600">
                      {currency.format(entry.expense)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {currency.format(entry.balance)}
                    </td>
                  </tr>
                ))}
                {ledgerEntries.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-black/40"
                    >
                      No ledger entries for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/5 p-5">
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <h3 className="font-medium">{exportTitle}</h3>
            </div>
            <p className="text-xs font-mono text-black/40">
              Confirmed value: {currency.format(completedRevenue)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#141414] text-white">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Category
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Guest / Source
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-widest">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{row.category}</td>
                    <td className="px-4 py-3 text-black/60">{row.reference}</td>
                    <td className="px-4 py-3">{row.guest}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-black/[0.04] px-2 py-1 text-[10px] font-mono uppercase text-black/60">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black/60">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {currency.format(row.amount)}
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-black/50">
                      {row.details}
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-black/40"
                    >
                      No records match the selected report filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
