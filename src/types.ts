export interface User {
  id: string;
  username: string;
  role: 'Admin' | 'Receptionist' | 'Waiter' | 'Barman' | 'Laundry';
  name: string;
  email?: string;
}

export interface Room {
  id: string;
  number: string;
  category: string;
  price: number;
  status: 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  type: 'Restaurant' | 'Bar';
}

export interface Order {
  id: string;
  table_number: string;
  items: any[];
  total_price: number;
  status: 'Pending' | 'Served' | 'Paid' | 'Cancelled';
  type: 'Restaurant' | 'Bar';
  created_at: string;
}

export interface LaundryOrder {
  id: string;
  guest_name: string;
  room_number: string;
  items: any[];
  total_price: number;
  status: 'Received' | 'In Progress' | 'Ready' | 'Delivered';
  created_at: string;
}

export interface Stats {
  activeGuests: number;
  availableRooms: number;
  pendingLaundry: number;
  totalRevenue: number;
}
