
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { mockBookings } from "../../data/mockData";

const BookingDetails = () => {
  const { id } = useParams();
  const booking = mockBookings.find(b => b.id === id);

  if (!booking) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Booking not found</h2>
        <Button asChild className="mt-4">
          <Link to="/vendor/bookings">Back to Bookings</Link>
        </Button>
      </div>
    );
  }

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
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/vendor/bookings">← Back to Bookings</Link>
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Booking Details</h1>
          <p className="text-gray-600 mt-1">{booking.eventName}</p>
        </div>
        <div className="space-x-2">
          <Button asChild variant="outline">
            <Link to={`/vendor/invoice/${booking.id}`}>View Invoice</Link>
          </Button>
          {booking.status !== 'paid' && (
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
              Make Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Booking Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Event Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700">Event Name</h4>
                  <p className="text-lg">{booking.eventName}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">Event Date</h4>
                  <p className="text-lg">{new Date(booking.eventDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">Booking Date</h4>
                  <p className="text-lg">{new Date(booking.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">Invoice Number</h4>
                  <p className="text-lg">{booking.invoiceNumber}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Stall Layout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 rounded-lg p-8">
                <svg width="100%" height="300" viewBox="0 0 500 250">
                  {/* Render all stalls for context, highlight booked ones */}
                  {Array.from({length: 12}, (_, i) => {
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const x = 50 + col * 100;
                    const y = 50 + row * 70;
                    const label = `${String.fromCharCode(65 + row)}${col + 1}`;
                    const isBooked = booking.stalls.some(stall => stall.label === label);
                    
                    return (
                      <g key={i}>
                        <rect
                          x={x}
                          y={y}
                          width={80}
                          height={50}
                          fill={isBooked ? '#3b82f6' : '#e5e7eb'}
                          stroke="#ffffff"
                          strokeWidth="2"
                          rx="4"
                        />
                        <text
                          x={x + 40}
                          y={y + 25}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={isBooked ? 'white' : '#6b7280'}
                          fontSize="12"
                          fontWeight="bold"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                    Your Stalls
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-gray-300 rounded mr-2"></div>
                    Other Stalls
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Summary */}
        <div>
          <Card className="shadow-lg sticky top-6">
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge className={getStatusBadge(booking.status)}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Badge>
                </div>
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-medium">Stalls Booked</h4>
                  {booking.stalls.map(stall => (
                    <div key={stall.id} className="flex justify-between text-sm">
                      <span>Stall {stall.label}</span>
                      <span>${stall.price}</span>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Total Amount:</span>
                    <span>${booking.totalAmount}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Paid:</span>
                    <span>${booking.paidAmount}</span>
                  </div>
                  {booking.paidAmount < booking.totalAmount && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Outstanding:</span>
                      <span>${booking.totalAmount - booking.paidAmount}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BookingDetails;
