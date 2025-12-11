

export interface BrandOption {
  name: string;
  price: number; // Override base price
}

export interface Product {
  id: string;
  name: string;
  price: number; // Base price (or starting price)
  mrp?: number; // Maximum Retail Price
  emoji: string;
  category: string;
  description?: string;
  ingredients?: string;
  nutrition?: string;
  brands?: BrandOption[]; // List of available brands
}

export interface Store {
  id: string;
  name: string;
  address: string;
  rating: number;
  distance: string; // e.g., "0.8 km"
  lat: number;
  lng: number;
  isOpen: boolean;
  type: 'general' | 'produce' | 'dairy'; // 'general' = Red, 'produce' = Green, 'dairy' = Blue
  availableProductIds: string[]; // List of product IDs available at this store
  upiId?: string; // NEW: Store Owner UPI
  ownerId?: string; // Link to profile
}

export interface InventoryItem extends Product {
  inStock: boolean;
  stock: number; // Quantity available
  storePrice: number; // The price set by the store owner
  isActive: boolean; // Is it listed in the store?
}

export interface CartItem extends Product {
  quantity: number;
  selectedBrand: string;     // The specific brand chosen
  originalProductId: string; // To link back to the main product for grouping
  storeId: string;
  storeName: string;
  storeType: Store['type'];
}

export type OrderMode = 'DELIVERY' | 'PICKUP';
export type DeliveryType = 'INSTANT' | 'SCHEDULED';

export interface SavedCard {
  id: string;
  type: 'VISA' | 'MASTERCARD' | 'UPI';
  last4?: string; // For cards
  upiId?: string; // For UPI
  label: string;
}

export interface UserState {
  isAuthenticated: boolean;
  id?: string;
  phone: string;
  email?: string;
  name?: string;
  address?: string;
  location: { lat: number; lng: number } | null;
  savedCards?: SavedCard[];
  role?: 'customer' | 'store_owner' | 'delivery_partner' | 'admin';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
}

export interface LocationResult {
  latitude: number;
  longitude: number;
}

// NEW: Payment Split Interface
export interface PaymentSplit {
  storeAmount: number;
  storeUpi?: string;
  handlingFee?: number; // Optional now
  adminUpi?: string;
  deliveryFee: number; // If 0, free for customer. If > 0, pay to driver.
  driverUpi?: string;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'Pending' | 'Preparing' | 'On the way' | 'Ready' | 'Delivered' | 'Picked Up' | 'Cancelled' | 'Placed' | 'Accepted' | 'Rejected';
  paymentStatus: 'PAID' | 'PENDING';
  paymentDeadline?: string; // For scheduled orders: 30 mins before slot
  mode: OrderMode;
  deliveryType: DeliveryType;
  scheduledTime?: string;
  deliveryAddress?: string;
  storeName: string;
  storeLocation?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number };
  
  // NEW: Split details
  splits?: PaymentSplit;
  customerName?: string;
  customerPhone?: string;
}