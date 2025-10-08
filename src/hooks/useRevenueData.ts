import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useRevenueData = (days: number = 30) => {
  return useQuery({
    queryKey: ['revenue-data', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('created_at, paid_amount, payment_status')
        .gte('created_at', startDate.toISOString())
        .eq('payment_status', 'success')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching revenue data:', error);
        throw error;
      }

      // Group by date
      const revenueByDate = bookings?.reduce((acc, booking) => {
        const date = new Date(booking.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        if (!acc[date]) acc[date] = 0;
        acc[date] += booking.paid_amount || 0;
        return acc;
      }, {} as Record<string, number>);

      // Convert to array for charting
      const chartData = Object.entries(revenueByDate || {}).map(([date, revenue]) => ({
        date,
        revenue
      }));

      return chartData;
    },
    staleTime: 300000, // Cache for 5 minutes
  });
};
