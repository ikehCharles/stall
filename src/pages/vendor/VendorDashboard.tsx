
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockBookings } from "../../data/mockData";

const VendorDashboard = () => {
  // Calculate metrics from mock data
  const totalStalls = mockBookings.reduce((sum, booking) => sum + booking.stalls.length, 0);
  const totalPaid = mockBookings.reduce((sum, booking) => sum + booking.paidAmount, 0);
  const totalAmount = mockBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const unpaidBalance = totalAmount - totalPaid;
  const upcomingBookings = mockBookings.filter(booking => new Date(booking.eventDate) > new Date()).length;

  const metrics = [
    {
      title: "Total Stalls Booked",
      value: totalStalls.toString(),
      icon: "🏪",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      title: "Total Paid",
      value: `$${totalPaid.toFixed(2)}`,
      icon: "💰",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      title: "Unpaid Balance",
      value: `$${unpaidBalance.toFixed(2)}`,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's your booking overview.</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
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

      {/* Recent Activity */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <span className="mr-2">📋</span>
            Recent Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockBookings.slice(0, 3).map((booking) => (
              <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div>
                  <h3 className="font-medium text-gray-900">{booking.eventName}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(booking.eventDate).toLocaleDateString()} • {booking.stalls.length} stall(s)
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">${booking.totalAmount}</div>
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    booking.status === 'paid' 
                      ? 'bg-green-100 text-green-800' 
                      : booking.status === 'partial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;
