import { MetricCard } from "@/components/admin/MetricsCards";
import { OccupancyChart } from "@/components/admin/OccupancyChart";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { KYCMetricsCard } from "@/components/admin/KYCMetricsCard";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { useStallOccupancy } from "@/hooks/useStallOccupancy";

const AdminDashboard = () => {
  const { data: analytics, isLoading: analyticsLoading } = useAdminAnalytics();
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
      value: `$${(analytics?.totalRevenue || 0).toFixed(2)}`,
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Real-time overview of marketplace operations</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RevenueChart />
        <KYCMetricsCard />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <OccupancyChart />
        <ActivityFeed />
      </div>
    </div>
  );
};

export default AdminDashboard;
