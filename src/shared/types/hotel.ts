export interface User {
  id: string;
  username: string;
  role: "Admin" | "Receptionist" | "Waiter" | "Barman" | "Laundry" | "Customer";
  name: string;
  email?: string;
}

export interface Room {
  id: string;
  number: string;
  category: string;
  price: number;
  status: "Available" | "Occupied" | "Cleaning" | "Maintenance";
  imageUrl?: string;
  description?: string;
  amenities?: string[];
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

export interface Order {
  id: string;
  table_number?: string;
  customer_name?: string;
  customer_email?: string;
  customer_uid?: string;
  items: any[];
  total_price: number;
  status: "Pending" | "Accepted" | "Preparing" | "Serving" | "Completed" | "Cancelled" | "Paid";
  type: "Restaurant" | "Bar";
  created_at: string;
  estimated_arrival?: string;
}

export interface LaundryOrder {
  id: string;
  guest_name: string;
  room_number?: string;
  customer_email?: string;
  customer_uid?: string;
  items: any[];
  total_price: number;
  status: "Received" | "In Progress" | "Ready" | "Delivered";
  created_at: string;
  estimated_arrival?: string;
}

export interface Stats {
  activeGuests: number;
  availableRooms: number;
  pendingLaundry: number;
  totalRevenue: number;
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

export interface LaundryService {
  id: string;
  name: string;
  price: number;
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
