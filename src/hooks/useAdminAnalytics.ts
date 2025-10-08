import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DateRange {
  start: Date;
  end: Date;
}

export const useAdminAnalytics = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['admin-analytics', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select('id, total_amount, paid_amount, payment_status, status, created_at');

      if (dateRange?.start) {
        query = query.gte('created_at', dateRange.start.toISOString());
      }
      if (dateRange?.end) {
        query = query.lte('created_at', dateRange.end.toISOString());
      }

      const { data: bookings, error } = await query;

      if (error) {
        console.error('Error fetching admin analytics:', error);
        throw error;
      }

      const totalBookings = bookings?.length || 0;
      const totalRevenue = bookings?.reduce((sum, b) => sum + (b.paid_amount || 0), 0) || 0;
      const pendingPayments = bookings?.filter(b => 
        b.payment_status === 'pending' || b.payment_status === 'failed'
      ).length || 0;

      return { totalBookings, totalRevenue, pendingPayments };
    },
    staleTime: 30000, // Cache for 30 seconds
  });
};
