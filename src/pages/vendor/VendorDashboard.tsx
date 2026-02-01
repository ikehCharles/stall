import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KYCBanner } from "@/components/kyc/KYCBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorBookings } from "@/hooks/useBookings";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import CurrencyWrapper from "@/components/shared/currency";

const VendorDashboard = () => {
  const { userProfile } = useAuth();
  const { data: bookings, isLoading } = useVendorBookings();

  // Calculate metrics from real data
  const totalStalls = bookings?.reduce((sum, booking) => sum + (booking.booking_stalls?.length || 0), 0) || 0;
  const totalPaid = bookings?.reduce((sum, booking) => sum + Number(booking.paid_amount || 0), 0) || 0;
  const totalAmount = bookings?.reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0) || 0;
  const unpaidBalance = totalAmount - totalPaid;
  const upcomingBookings = bookings?.filter(booking => 
    booking.markets && new Date(booking.markets.start_at) > new Date()
  ).length || 0;

  const metrics = [
    {
      title: "Total Stalls Booked",
      value: totalStalls.toString(),
      icon: "🏪",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      title: "Total Paid",
      value: `${formatCurrency(totalPaid)}`,
      icon: "💰",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      title: "Unpaid Balance",
      value: `${formatCurrency(unpaidBalance)}`,
      icon: "⚠️",
      gradient: "from-orange-500 to-red-500"
    },
    {
      title: "Upcoming Bookings",
      value: upcomingBookings.toString(),
      icon: "📅",
      gradient: "from-purple-500 to-pink-500"
    }
  ];

  return (
    <div className="space-y-8">
      {/* KYC Banner */}
      <KYCBanner status={userProfile?.kyc_status || 'NOT_STARTED'} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's your booking overview.</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          metrics.map((metric) => (
            <Card key={metric.title} className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {metric.title}
                </CardTitle>
                <span className="text-2xl">{metric.icon}</span>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{metric.value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Activity */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <span className="mr-2">📋</span>
            Recent Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : !bookings || bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No bookings yet. Start by booking a stall!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.slice(0, 3).map((booking) => {
                const statusDisplay = booking.payment_status === 'success' ? 'Paid' 
                  : booking.payment_status === 'pending' ? 'Pending' 
                  : 'Failed';
                const statusColor = booking.payment_status === 'success' 
                  ? 'bg-green-100 text-green-800' 
                  : booking.payment_status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800';

                return (
                  <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <h3 className="font-medium text-gray-900">{booking.markets?.name || 'Unknown Market'}</h3>
                      <p className="text-sm text-gray-600">
                        {booking.markets?.start_at ? new Date(booking.markets.start_at).toLocaleDateString() : 'No date'} • {booking.booking_stalls?.length || 0} stall(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900"><CurrencyWrapper amount={booking.total_amount || 0} /> </div>
                      <div className={`text-sm px-2 py-1 rounded-full ${statusColor}`}>
                        {statusDisplay}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;
