import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type BookingDate = Database['public']['Tables']['booking_dates']['Row'];

export const useBookingDates = (marketId: string) => {
  return useQuery({
    queryKey: ['booking-dates', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_dates')
        .select(`
          *,
          bookings!inner(
            market_id,
            status,
            user_id
          )
        `)
        .eq('bookings.market_id', marketId)
        .in('bookings.status', ['paid', 'pending', 'partial']);
      
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
        .in('bookings.status', ['paid', 'pending', 'partial']);
      
      if (error) throw error;
      return data.map(item => item.booking_date);
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