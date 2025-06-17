
export interface Stall {
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
}

export interface Booking {
  id: string;
  vendorId: string;
  vendorName: string;
  eventName: string;
  eventDate: string;
  stalls: Stall[];
  totalAmount: number;
  paidAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
  createdAt: string;
  invoiceNumber: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  description: string;
}

export const mockStalls: Stall[] = [
  { id: '1', label: 'A1', x: 50, y: 50, width: 80, height: 60, price: 150, description: 'Corner stall with high foot traffic', isBooked: false },
  { id: '2', label: 'A2', x: 150, y: 50, width: 80, height: 60, price: 120, description: 'Standard stall with good visibility', isBooked: true, bookedBy: 'vendor@example.com' },
  { id: '3', label: 'A3', x: 250, y: 50, width: 80, height: 60, price: 120, description: 'Standard stall', isBooked: false },
  { id: '4', label: 'A4', x: 350, y: 50, width: 80, height: 60, price: 130, description: 'Near main entrance', isBooked: false },
  { id: '5', label: 'B1', x: 50, y: 130, width: 80, height: 60, price: 110, description: 'Second row stall', isBooked: false },
  { id: '6', label: 'B2', x: 150, y: 130, width: 80, height: 60, price: 110, description: 'Second row stall', isBooked: true, bookedBy: 'other@example.com' },
  { id: '7', label: 'B3', x: 250, y: 130, width: 80, height: 60, price: 110, description: 'Second row stall', isBooked: false },
  { id: '8', label: 'B4', x: 350, y: 130, width: 80, height: 60, price: 110, description: 'Second row stall', isBooked: false },
  { id: '9', label: 'C1', x: 50, y: 210, width: 80, height: 60, price: 100, description: 'Back row stall', isBooked: false },
  { id: '10', label: 'C2', x: 150, y: 210, width: 80, height: 60, price: 100, description: 'Back row stall', isBooked: false },
  { id: '11', label: 'C3', x: 250, y: 210, width: 80, height: 60, price: 100, description: 'Back row stall', isBooked: false },
  { id: '12', label: 'C4', x: 350, y: 210, width: 80, height: 60, price: 100, description: 'Back row stall', isBooked: false },
];

export const mockBookings: Booking[] = [
  {
    id: '1',
    vendorId: '1',
    vendorName: 'John Vendor',
    eventName: 'Summer Market Festival',
    eventDate: '2024-07-15',
    stalls: [mockStalls[1]],
    totalAmount: 120,
    paidAmount: 120,
    status: 'paid',
    createdAt: '2024-06-15',
    invoiceNumber: 'INV-2024-001'
  },
  {
    id: '2',
    vendorId: '1',
    vendorName: 'John Vendor',
    eventName: 'Winter Holiday Market',
    eventDate: '2024-12-20',
    stalls: [mockStalls[0], mockStalls[4]],
    totalAmount: 260,
    paidAmount: 130,
    status: 'partial',
    createdAt: '2024-11-01',
    invoiceNumber: 'INV-2024-002'
  }
];

export const mockEvents: Event[] = [
  {
    id: '1',
    name: 'Summer Market Festival',
    date: '2024-07-15',
    location: 'Central Park',
    description: 'Annual summer market with over 100 vendors'
  },
  {
    id: '2',
    name: 'Winter Holiday Market',
    date: '2024-12-20',
    location: 'Downtown Square',
    description: 'Festive holiday market perfect for gift shopping'
  }
];
