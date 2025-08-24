// localStorage utilities for data persistence

export interface KYCData {
  id: string;
  vendorId: string;
  businessName: string;
  contactDetails: {
    email: string;
    phone: string;
    address: string;
  };
  idDocumentUpload?: string; // base64 or file reference
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface StallLayout {
  id: string;
  name: string;
  eventId: string;
  backgroundImage?: string;
  stalls: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    price: number;
    description: string;
    isBooked: boolean;
    bookedBy?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface BookingData {
  id: string;
  vendorId: string;
  vendorName: string;
  eventName: string;
  eventDate: string;
  layoutId: string;
  stallIds: string[];
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'CANCELLED';
  paymentMethod?: string;
  createdAt: string;
  invoiceNumber: string;
}

// Generic localStorage operations
class LocalStorageManager {
  private getKey(type: string): string {
    return `stallBooking_${type}`;
  }

  get<T>(type: string): T[] {
    try {
      const data = localStorage.getItem(this.getKey(type));
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error getting ${type} from localStorage:`, error);
      return [];
    }
  }

  set<T>(type: string, data: T[]): void {
    try {
      localStorage.setItem(this.getKey(type), JSON.stringify(data));
    } catch (error) {
      console.error(`Error setting ${type} to localStorage:`, error);
    }
  }

  add<T extends { id: string }>(type: string, item: T): T {
    const items = this.get<T>(type);
    const newItem = { ...item, id: item.id || this.generateId() };
    items.push(newItem);
    this.set(type, items);
    return newItem;
  }

  update<T extends { id: string }>(type: string, id: string, updates: Partial<T>): T | null {
    const items = this.get<T>(type);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    items[index] = { ...items[index], ...updates };
    this.set(type, items);
    return items[index];
  }

  delete<T extends { id: string }>(type: string, id: string): boolean {
    const items = this.get<T>(type);
    const filteredItems = items.filter((item: T) => item.id !== id);
    if (filteredItems.length === items.length) return false;
    
    this.set(type, filteredItems);
    return true;
  }

  findById<T extends { id: string }>(type: string, id: string): T | null {
    const items = this.get<T>(type);
    return items.find((item: T) => item.id === id) || null;
  }

  findBy<T>(type: string, predicate: (item: T) => boolean): T[] {
    const items = this.get<T>(type);
    return items.filter(predicate);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const storageManager = new LocalStorageManager();

// Specific data access functions
export const kycStorage = {
  getAll: () => storageManager.get<KYCData>('kyc'),
  getByVendorId: (vendorId: string) => storageManager.findBy<KYCData>('kyc', kyc => kyc.vendorId === vendorId)[0],
  add: (kyc: Omit<KYCData, 'id'>) => storageManager.add('kyc', { ...kyc, id: crypto.randomUUID() }),
  update: (id: string, updates: Partial<KYCData>) => storageManager.update<KYCData>('kyc', id, updates),
  delete: (id: string) => storageManager.delete<KYCData>('kyc', id),
};

export const layoutStorage = {
  getAll: () => storageManager.get<StallLayout>('layouts'),
  getById: (id: string) => storageManager.findById<StallLayout>('layouts', id),
  add: (layout: Omit<StallLayout, 'id'>) => storageManager.add('layouts', { ...layout, id: crypto.randomUUID() }),
  update: (id: string, updates: Partial<StallLayout>) => storageManager.update<StallLayout>('layouts', id, updates),
  delete: (id: string) => storageManager.delete<StallLayout>('layouts', id),
};

export const bookingStorage = {
  getAll: () => storageManager.get<BookingData>('bookings'),
  getByVendorId: (vendorId: string) => storageManager.findBy<BookingData>('bookings', booking => booking.vendorId === vendorId),
  add: (booking: Omit<BookingData, 'id'>) => storageManager.add('bookings', { ...booking, id: crypto.randomUUID() }),
  update: (id: string, updates: Partial<BookingData>) => storageManager.update<BookingData>('bookings', id, updates),
  delete: (id: string) => storageManager.delete<BookingData>('bookings', id),
};