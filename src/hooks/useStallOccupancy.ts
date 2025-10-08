import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useStallOccupancy = (marketId?: string) => {
  return useQuery({
    queryKey: ['stall-occupancy', marketId],
    queryFn: async () => {
      let stallQuery = supabase
        .from('stall_instances')
        .select('id, market_id, markets(name)');
      
      if (marketId) {
        stallQuery = stallQuery.eq('market_id', marketId);
      }

      const { data: stalls, error: stallsError } = await stallQuery;

      if (stallsError) {
        console.error('Error fetching stalls:', stallsError);
        throw stallsError;
      }

      // Get booked stalls (with status = 'booked' in booking_dates)
      const { data: bookedDates, error: bookedError } = await supabase
        .from('booking_dates')
        .select('stall_instance_id')
        .eq('status', 'booked')
        .gte('date', new Date().toISOString().split('T')[0]); // Only current/future bookings

      if (bookedError) {
        console.error('Error fetching booked dates:', bookedError);
        throw bookedError;
      }

      const uniqueBookedStalls = new Set(bookedDates?.map(bd => bd.stall_instance_id));

      const totalStalls = stalls?.length || 0;
      const bookedStalls = uniqueBookedStalls.size;
      const availableStalls = totalStalls - bookedStalls;
      const occupancyRate = totalStalls > 0 ? (bookedStalls / totalStalls) * 100 : 0;

      return { totalStalls, bookedStalls, availableStalls, occupancyRate };
    },
    staleTime: 30000,
  });
};
