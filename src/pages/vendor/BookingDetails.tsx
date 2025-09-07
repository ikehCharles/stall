
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBookingDetails } from "@/hooks/useBookings";
import { format } from "date-fns";

const BookingDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading, error } = useBookingDetails(id || '');

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2].map(i => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-40 animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div>
            <Card>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Booking not found</h2>
        <p className="text-muted-foreground mt-2">The booking you're looking for could not be found.</p>
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
      pending: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return variants[status as keyof typeof variants] || variants.pending;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/vendor/bookings">← Back to Bookings</Link>
          </Button>
          <h1 className="text-3xl font-bold">Booking Details</h1>
          <p className="text-muted-foreground mt-1">{booking.markets?.name}</p>
        </div>
        <div className="space-x-2">
          <Button asChild variant="outline">
            <Link to={`/vendor/invoice/${booking.id}`}>View Invoice</Link>
          </Button>
          {booking.status !== 'paid' && (
            <Button>
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
                  <h4 className="font-medium text-muted-foreground">Market Name</h4>
                  <p className="text-lg">{booking.markets?.name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">Market Date</h4>
                  <p className="text-lg">
                    {booking.markets?.start_at ? format(new Date(booking.markets.start_at), "PPP") : 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">Booking Date</h4>
                  <p className="text-lg">{format(new Date(booking.created_at), "PPP")}</p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">Invoice Number</h4>
                  <p className="text-lg">{booking.invoice_number}</p>
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
                <svg width="100%" height="300" viewBox="0 0 800 600">
                  {booking.booking_stalls?.map((bs, i) => {
                    const stall = bs.stall_instances;
                    if (!stall) return null;
                    
                    return (
                      <g key={bs.id}>
                        <rect
                          x={stall.x}
                          y={stall.y}
                          width={stall.width}
                          height={stall.height}
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth="2"
                          rx="4"
                        />
                        <text
                          x={stall.x + stall.width / 2}
                          y={stall.y + stall.height / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize="14"
                          fontWeight="bold"
                        >
                          {stall.label}
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
                  {booking.booking_stalls?.map(bs => (
                    <div key={bs.id} className="flex justify-between text-sm">
                      <span>Stall {bs.stall_instances?.label}</span>
                      <span>${bs.price_at_booking}</span>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Total Amount:</span>
                    <span>${booking.total_amount}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Paid:</span>
                    <span>${booking.paid_amount}</span>
                  </div>
                  {booking.paid_amount < booking.total_amount && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Outstanding:</span>
                      <span>${booking.total_amount - booking.paid_amount}</span>
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
