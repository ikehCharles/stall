import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DateRange {
  start: Date;
  end: Date;
}

export const useRevenueData = (dateRange?: DateRange) => {
  const fallbackStart = new Date();
  fallbackStart.setDate(fallbackStart.getDate() - 30);
  const start = dateRange?.start ?? fallbackStart;
  const end = dateRange?.end ?? new Date();

  return useQuery({
    queryKey: ['revenue-data', start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('created_at, paid_amount, payment_status, vat_amount, net_amount')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
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
        if (!acc[date]) acc[date] = { revenue: 0, vat: 0, net: 0 };
        acc[date].revenue += booking.paid_amount || 0;
        acc[date].vat += booking.vat_amount || 0;
        acc[date].net += booking.net_amount || (booking.paid_amount || 0);
        return acc;
      }, {} as Record<string, { revenue: number; vat: number; net: number }>);

      // Convert to array for charting
      const chartData = Object.entries(revenueByDate || {}).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        vat: data.vat,
        net: data.net,
      }));

      return chartData;
    },
    staleTime: 300000, // Cache for 5 minutes
  });
};
