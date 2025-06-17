
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockBookings, mockStalls } from "../../data/mockData";

const AdminDashboard = () => {
  // Calculate metrics
  const totalBookings = mockBookings.length;
  const totalRevenue = mockBookings.reduce((sum, booking) => sum + booking.paidAmount, 0);
  const bookedStalls = mockStalls.filter(stall => stall.isBooked).length;
  const availableStalls = mockStalls.filter(stall => !stall.isBooked).length;
  const pendingPayments = mockBookings.filter(booking => booking.status !== 'paid').length;

  const metrics = [
    {
      title: "Total Bookings",
      value: totalBookings.toString(),
      icon: "📋",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: "💰",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      title: "Booked Stalls",
      value: `${bookedStalls}/${mockStalls.length}`,
      icon: "🏪",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      title: "Pending Payments",
      value: pendingPayments.toString(),
      icon: "⚠️",
      gradient: "from-orange-500 to-red-500"
    }
  ];

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: "bg-green-100 text-green-800",
      partial: "bg-yellow-100 text-yellow-800",
      unpaid: "bg-red-100 text-red-800"
    };
    return variants[status as keyof typeof variants] || variants.unpaid;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your marketplace operations</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
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
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Bookings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">📋</span>
              Recent Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockBookings.slice(0, 5).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{booking.vendorName}</h3>
                    <p className="text-sm text-gray-600">
                      {booking.eventName} • {booking.stalls.length} stall(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">${booking.totalAmount}</div>
                    <Badge className={getStatusBadge(booking.status)}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stall Occupancy */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">🏪</span>
              Stall Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Occupancy Rate</span>
                <span className="font-medium">{Math.round((bookedStalls / mockStalls.length) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(bookedStalls / mockStalls.length) * 100}%` }}
                ></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{bookedStalls}</div>
                  <div className="text-sm text-gray-600">Booked</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{availableStalls}</div>
                  <div className="text-sm text-gray-600">Available</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
