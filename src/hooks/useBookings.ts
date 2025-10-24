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
    theme: string;
  };
  profiles?: {
    full_name: string | null;
    email: string;
    phone_number: string | null;
    company_name: string | null;
    address: string | null;
  };
  booking_dates?: {
    id: string;
    stall_instance_id: string;
    booking_date: string;
    status: string;
  }[];
}

export const useVendorBookings = () => {
  return useQuery({
    queryKey: ['vendor-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          markets(name, start_at, end_at, theme),
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
          markets(name, start_at, end_at, theme),
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
          ),
          booking_dates(
            id,
            stall_instance_id,
            booking_date,
            status
          )
        `)
        .eq('id', bookingId)
        .single();
      
      if (error) throw error;

      // Fetch profile separately using user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone_number, company_name, address')
        .eq('id', data.user_id)
        .single();

      return {
        ...data,
        profiles: profile || undefined
      } as BookingWithStalls;
    },
    enabled: !!bookingId,
  });
};

export interface CreateBookingData {
  marketId: string;
  stallIds: string[];
  totalAmount: number;
  selectedDates?: string[];
  pricePerDay?: number;
}

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bookingData: CreateBookingData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Validate 5-day maximum
      const daysCount = bookingData.selectedDates?.length || 1;
      if (daysCount > 5) {
        throw new Error('Maximum 5 days can be selected per booking');
      }
      if (daysCount < 1) {
        throw new Error('At least 1 day must be selected');
      }

      // Generate invoice number
      const { data: invoiceNumber, error: invoiceError } = await supabase
        .rpc('generate_invoice_number');
      
      if (invoiceError) throw invoiceError;

      const pricePerDay = bookingData.pricePerDay || (bookingData.totalAmount / daysCount);

      // Create the booking with hold expiry and new status
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          market_id: bookingData.marketId,
          total_amount: bookingData.totalAmount,
          paid_amount: 0,
          status: 'pending' as const,
          invoice_number: invoiceNumber,
          selected_dates: bookingData.selectedDates,
          days_count: daysCount,
          price_per_day: pricePerDay,
          hold_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15-minute hold
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create booking_stalls entries
      const bookingStalls = bookingData.stallIds.map(stallId => ({
        booking_id: booking.id,
        stall_instance_id: stallId,
        price_at_booking: pricePerDay
      }));

      const { error: stallsError } = await supabase
        .from('booking_stalls')
        .insert(bookingStalls);

      if (stallsError) throw stallsError;

      // If dates are specified, create booking_dates entries
      if (bookingData.selectedDates && bookingData.selectedDates.length > 0) {
        const bookingDates = [];
        for (const stallId of bookingData.stallIds) {
          for (const date of bookingData.selectedDates) {
            bookingDates.push({
              booking_id: booking.id,
              stall_instance_id: stallId,
              booking_date: date
            });
          }
        }

        const { error: datesError } = await supabase
          .from('booking_dates')
          .insert(bookingDates);

        if (datesError) throw datesError;
      }

      // Clean up any holds for this user and these stalls
      const { error: holdError } = await supabase
        .from('stall_holds')
        .delete()
        .eq('user_id', user.id)
        .in('stall_instance_id', bookingData.stallIds);

      if (holdError) console.warn('Failed to clean up holds:', holdError);

      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['stall-instances'] });
      queryClient.invalidateQueries({ queryKey: ['booking-dates'] });
      queryClient.invalidateQueries({ queryKey: ['stall-holds'] });
    },
  });
};

// Payment stub functionality - now only handles payment status
export const usePaymentStub = () => {
  return useMutation({
    mutationFn: async (bookingId: string) => {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update payment status to success
      const { data, error } = await supabase.rpc('simulate_payment_success', {
        p_booking_id: bookingId
      });

      if (error) throw error;
      return data;
    },
  });
};

// Manual cancellation functionality
export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('cancel_booking', {
        p_booking_id: bookingId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-details'] });
      queryClient.invalidateQueries({ queryKey: ['stall-holds'] });
      queryClient.invalidateQueries({ queryKey: ['stall-instances'] });
      queryClient.invalidateQueries({ queryKey: ['booking-dates'] });
    },
  });
};