import { useState } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { MetricCard } from "@/components/admin/MetricsCards";
import { OccupancyChart } from "@/components/admin/OccupancyChart";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { KYCMetricsCard } from "@/components/admin/KYCMetricsCard";
import { DateRangeFilter, type DateRangeValue } from "@/components/admin/DateRangeFilter";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { useStallOccupancy } from "@/hooks/useStallOccupancy";
import { formatCurrency } from "@/lib/utils";

const AdminDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    start: startOfDay(subDays(new Date(), 29)),
    end: endOfDay(new Date()),
  });
  const [activePreset, setActivePreset] = useState("Last 30 Days");

  const { data: analytics, isLoading: analyticsLoading } = useAdminAnalytics(dateRange);
  const { data: occupancy, isLoading: occupancyLoading } = useStallOccupancy();

  const metrics = [
    {
      title: "Total Bookings",
      value: analytics?.totalBookings || 0,
      icon: "📋",
      gradient: "from-blue-500 to-cyan-500",
      loading: analyticsLoading
    },
    {
      title: "Total Revenue",
      value: `${formatCurrency(analytics?.totalRevenue || 0)}`,
      icon: "💰",
      gradient: "from-green-500 to-emerald-500",
      loading: analyticsLoading
    },
    {
      title: "Stall Occupancy",
      value: `${(occupancy?.occupancyRate || 0).toFixed(1)}%`,
      icon: "🏪",
      gradient: "from-purple-500 to-pink-500",
      subtitle: `${occupancy?.bookedStalls || 0}/${occupancy?.totalStalls || 0} stalls`,
      loading: occupancyLoading
    },
    {
      title: "Pending Payments",
      value: analytics?.pendingPayments || 0,
      icon: "⚠️",
      gradient: "from-orange-500 to-red-500",
      loading: analyticsLoading
    }
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Header + Date Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of marketplace operations</p>
        </div>
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          activePreset={activePreset}
          onPresetChange={setActivePreset}
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Revenue Chart — Full Width */}
      <RevenueChart dateRange={dateRange} />

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <KYCMetricsCard dateRange={dateRange} />
        <OccupancyChart />
      </div>
    </div>
  );
};

export default AdminDashboard;
