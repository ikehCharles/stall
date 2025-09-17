import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useBookingDatesForBooking = (bookingId: string) => {
  return useQuery({
    queryKey: ['booking-dates-for-booking', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_dates')
        .select('booking_date')
        .eq('booking_id', bookingId)
        .order('booking_date', { ascending: true });
      
      if (error) throw error;
      return data?.map(item => item.booking_date) || [];
    },
    enabled: !!bookingId,
  });
};