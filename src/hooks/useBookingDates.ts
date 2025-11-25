import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export interface BookingDate{
  id: string;
  booking_id: string;
  stall_instance_id: string;
  booking_date: string;
  created_at: string;
  bookings: {
      id: string;
      market_id: string;
      status: "pending" | "cancelled" | "approved" | "completed" | "expired" | "reserved";
      user_id: string;
  };
}

export const useBookingDates = (marketId: string) => {
  return useQuery({
    queryKey: ['booking-dates', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_dates')
        .select(`
          id,
          booking_id,
          stall_instance_id,
          booking_date,
          created_at,
          bookings!inner(
            id,
            market_id,
            status,
            user_id
          )
        `)
        .eq('bookings.market_id', marketId)
        .in('bookings.status', ['pending', 'approved', 'completed']);
      
      if (error) throw error;
      return data;
    },
    enabled: !!marketId,
  });
};

export const useStallBookingDates = (stallInstanceId: string) => {
  return useQuery({
    queryKey: ['stall-booking-dates', stallInstanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_dates')
        .select(`
          booking_date,
          bookings!inner(
            status
          )
        `)
        .eq('stall_instance_id', stallInstanceId)
        .in('bookings.status', ['pending', 'approved', 'completed', 'reserved']);
      
      if (error) throw error;
      return data;
    },
    enabled: !!stallInstanceId,
  });
};

export const useCreateBookingDates = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bookingDates: Array<{
      booking_id: string;
      stall_instance_id: string;
      booking_date: string;
    }>) => {
      const { data, error } = await supabase
        .from('booking_dates')
        .insert(bookingDates)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-dates'] });
      queryClient.invalidateQueries({ queryKey: ['stall-booking-dates'] });
    },
  });
};