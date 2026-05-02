export interface User {
  id: string;
  username: string;
  role:
    | "Admin"
    | "Receptionist"
    | "Waiter"
    | "Barman"
    | "Laundry man"
    | "Customer"
    | "System Developer";
  name: string;
  email?: string;
}

export interface Room {
  id: string;
  number: string;
  category: string;
  price: number;
  status:
    | "Available"
    | "Occupied"
    | "Cleaning"
    | "Maintenance"
    | "Booked"
    | "Checked In"
    | "Checked Out";
  imageUrl?: string;
  description?: string;
  amenities?: string[];
  breakfastIncluded?: boolean;
  breakfastPrice?: number;
  additionalServices?: { name: string; price: number }[];
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice?: number;
  type: "Restaurant" | "Bar";
  status: "Available" | "Out of Stock";
  stock?: number;
  minStock?: number;
  imageUrl?: string;
}

export interface OrderItem extends MenuItem {
  qty: number;
}

export interface Order {
  id: string;
  table_number?: string;
  customer_name?: string;
  customer_email?: string;
  customer_uid?: string;
  items: OrderItem[];
  total_price: number;
  status:
    | "Pending"
    | "Accepted"
    | "Preparing"
    | "Serving"
    | "Completed"
    | "Cancelled"
    | "Paid";
  type: "Restaurant" | "Bar";
  created_at: string;
  estimated_arrival?: string;
}

export interface LaundryService {
  id: string;
  name: string;
  price: number;
}

export interface LaundryOrderItem extends LaundryService {
  qty: number;
}

export interface LaundryOrder {
  id: string;
  guest_name: string;
  room_number?: string;
  customer_email?: string;
  customer_uid?: string;
  items: LaundryOrderItem[];
  total_price: number;
  status: "Received" | "In Progress" | "Ready" | "Delivered";
  created_at: string;
  estimated_arrival?: string;
}

export interface RoomBooking {
  id: string;
  room_id: string;
  room_number: string;
  guest_uid: string;
  guest_name: string;
  guest_email?: string;
  total_price: number;
  breakfast_included: boolean;
  additional_services: string[];
  status:
    | "Pending"
    | "Confirmed"
    | "Checked In"
    | "Checked Out"
    | "Cancelled"
    | "Active";
  check_in: string;
  check_out: string;
  created_at: string;
}

export interface ConferenceRoom {
  id: string;
  name: string;
  capacity: number;
  price_per_hour: number;
  status: "Available" | "Booked" | "Maintenance";
}

export interface ConferenceService {
  id: string;
  name: string;
  price: number;
}

export interface ConferenceBooking {
  id: string;
  room_id: string;
  client_name: string;
  client_uid: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: "Confirmed" | "Cancelled" | "Completed";
  created_at: string;
}

export interface GlobalPreference {
  id: string;
  name: string;
  price: number;
  created_at?: string;
}

export interface Stats {
  activeGuests: number;
  availableRooms: number;
  pendingLaundry: number;
  totalRevenue: number;
}

export interface Notification {
  id: string;
  userId?: string;
  role?: string;
  title: string;
  message: string;
  type: "order" | "laundry" | "conference" | "system";
  read: boolean;
  created_at: string;
  orderId?: string;
  targetTab?: string;
}
