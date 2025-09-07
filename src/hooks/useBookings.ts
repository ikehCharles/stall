import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Booking = Database['public']['Tables']['bookings']['Row'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
type BookingStall = Database['public']['Tables']['booking_stalls']['Row'];

export interface BookingWithStalls extends Booking {
  booking_stalls: (BookingStall & {
    stall_instances: {
      id: string;
      label: string;
      x: number;
      y: number;
      width: number;
      height: number;
      stall_templates: {
        name: string;
      };
    };
  })[];
  markets: {
    name: string;
    start_at: string;
    end_at: string;
  };
}

export const useVendorBookings = () => {
  return useQuery({
    queryKey: ['vendor-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          markets(name, start_at, end_at),
          booking_stalls(
            *,
            stall_instances(
              id,
              label,
              x,
              y,
              width,
              height,
              stall_templates(name)
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BookingWithStalls[];
    },
  });
};

export const useBookingDetails = (bookingId: string) => {
  return useQuery({
    queryKey: ['booking-details', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          markets(name, start_at, end_at),
          booking_stalls(
            *,
            stall_instances(
              id,
              label,
              x,
              y,
              width,
              height,
              stall_templates(name)
            )
          )
        `)
        .eq('id', bookingId)
        .single();
      
      if (error) throw error;
      return data as BookingWithStalls;
    },
    enabled: !!bookingId,
  });
};

export interface CreateBookingData {
  marketId: string;
  stallIds: string[];
  totalAmount: number;
}

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bookingData: CreateBookingData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Generate invoice number
      const { data: invoiceNumber, error: invoiceError } = await supabase
        .rpc('generate_invoice_number');
      
      if (invoiceError) throw invoiceError;

      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          market_id: bookingData.marketId,
          total_amount: bookingData.totalAmount,
          invoice_number: invoiceNumber,
          status: 'pending'
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create booking_stalls entries
      const stallEntries = bookingData.stallIds.map(stallId => ({
        booking_id: booking.id,
        stall_instance_id: stallId,
        price_at_booking: bookingData.totalAmount / bookingData.stallIds.length // Simple division for now
      }));

      const { error: stallsError } = await supabase
        .from('booking_stalls')
        .insert(stallEntries);

      if (stallsError) throw stallsError;

      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['stall-instances'] });
    },
  });
};

// Payment stub functionality
export const usePaymentStub = () => {
  return useMutation({
    mutationFn: async (bookingId: string) => {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // First get the booking to get total amount
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('total_amount')
        .eq('id', bookingId)
        .single();

      if (fetchError) throw fetchError;

      // Update booking status to paid
      const { data, error } = await supabase
        .from('bookings')
        .update({ 
          status: 'paid',
          paid_amount: booking.total_amount
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
};