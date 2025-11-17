import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBookingDetails } from "@/hooks/useBookings";
import { useBookingDatesForBooking } from "@/hooks/useBookingDatesForBooking";
import { useStallInstances } from "@/hooks/useStallInstances";
import { BookingHoldTimer } from "@/components/vendor/BookingHoldTimer";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  useAuthorizePayment,
  useCapturePayment,
} from "@/hooks/use-payment";
import { INTENT } from "@/lib/enums";

const BookingConfirmation = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { data: bookingDates = [] } = useBookingDatesForBooking(id || "");
  const { data: booking, isLoading: isLoadingBooking } = useBookingDetails(
    id || ""
  );
  const { data: allStalls = [] } = useStallInstances(booking?.market_id || "");
  const {
    mutateAsync: capturePayment,
    isPending: isLoading,
    error,
  } = useCapturePayment();
  const {
    mutateAsync: authorizePayment,
    isPending: isAuthorizeLoading,
    error: authorizeError,
  } = useAuthorizePayment();

  useEffect(() => {
    const intent = Number(queryParams.get("intent") || 0);
    if (queryParams.get("token")) {
      if (intent === INTENT.AUTHORIZE) {
        authorizePayment(queryParams.get("token") || "");
      } else {
        capturePayment(queryParams.get("token") || "");
      }
    } else {
      navigate(`/vendor/bookings/${id}`);
    }
  }, []);

  if (isLoading || isLoadingBooking || isAuthorizeLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2].map((i) => (
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

  if (error || authorizeError) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">
          Error {error ? "verifying" : "authorizing"} payment
        </h2>
        <p className="text-muted-foreground mt-2">Kindly try again</p>
        <Button asChild className="mt-4">
          <Link to={"/vendor/bookings"}>Back to Bookings</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "approved":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "expired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "success":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const formatBookingDates = (dates: string[]) => {
    if (dates.length === 0) return "No dates selected";

    const sortedDates = dates.sort();
    const formattedDates = sortedDates.map((date) =>
      format(new Date(date), "MMM d")
    );

    if (formattedDates.length <= 3) {
      return formattedDates.join(", ");
    }

    // Group consecutive dates
    const groups: string[] = [];
    let start = 0;

    for (let i = 1; i <= formattedDates.length; i++) {
      if (
        i === formattedDates.length ||
        new Date(sortedDates[i]).getTime() -
          new Date(sortedDates[i - 1]).getTime() >
          24 * 60 * 60 * 1000
      ) {
        if (i - start === 1) {
          groups.push(formattedDates[start]);
        } else if (i - start === 2) {
          groups.push(`${formattedDates[start]}, ${formattedDates[i - 1]}`);
        } else {
          groups.push(`${formattedDates[start]}-${formattedDates[i - 1]}`);
        }
        start = i;
      }
    }

    return groups.join(", ");
  };

  const bookedStallIds =
    booking?.booking_stalls?.map((bs) => bs.stall_instance_id) || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link to={"/vendor/bookings"}>← Back to Bookings</Link>
          </Button>
          <h1 className="text-3xl font-bold">Booking Details</h1>
          <p className="text-muted-foreground mt-1">{booking?.markets?.name}</p>
        </div>
        <div className="space-x-2">
          <Button asChild variant="outline">
            <Link to={`/vendor/invoice/${booking.id}`}>View Invoice</Link>
          </Button>
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
                  <h4 className="font-medium text-muted-foreground">
                    Market Name
                  </h4>
                  <p className="text-lg">{booking.markets?.name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">
                    Market Start Date
                  </h4>
                  <p className="text-lg">
                    {booking.markets?.start_at
                      ? format(new Date(booking.markets.start_at), "PPPP")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">
                    Market End Date
                  </h4>
                  <p className="text-lg">
                    {booking.markets?.end_at
                      ? format(new Date(booking.markets.end_at), "PPPP")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">
                    Booking Date
                  </h4>
                  <p className="text-lg">
                    {format(new Date(booking.created_at), "PPP")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">
                    Invoice Number
                  </h4>
                  <p className="text-lg">{booking.invoice_number}</p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">
                    Selected Dates
                  </h4>
                  <p className="text-lg">{formatBookingDates(bookingDates)}</p>
                </div>
              </div>

              {/* {booking.hold_expires_at &&
                ["pending", "failed"].includes(booking.payment_status) && (
                  <div className="pt-2">
                    <BookingHoldTimer
                      bookingId={booking.id}
                      expiresAt={booking.hold_expires_at}
                    />
                  </div>
                )} */}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Stall Layout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-8">
                <svg width="100%" height="300" viewBox="0 0 800 600">
                  {/* Render all stalls */}
                  {allStalls.map((stall) => {
                    const isBooked = bookedStallIds.includes(stall.id);

                    return (
                      <g key={stall.id}>
                        <rect
                          x={stall.x}
                          y={stall.y}
                          width={stall.width}
                          height={stall.height}
                          fill={
                            isBooked
                              ? "hsl(var(--primary))"
                              : "hsl(var(--muted))"
                          }
                          stroke={
                            isBooked
                              ? "hsl(var(--primary-foreground))"
                              : "hsl(var(--border))"
                          }
                          strokeWidth="2"
                          rx="4"
                        />
                        <text
                          x={stall.x + stall.width / 2}
                          y={stall.y + stall.height / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={
                            isBooked
                              ? "hsl(var(--primary-foreground))"
                              : "hsl(var(--muted-foreground))"
                          }
                          fontSize="14"
                          fontWeight={isBooked ? "bold" : "normal"}
                        >
                          {stall.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded mr-2"
                      style={{ backgroundColor: "hsl(var(--primary))" }}
                    ></div>
                    Your Stalls
                  </div>
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded mr-2"
                      style={{ backgroundColor: "hsl(var(--muted))" }}
                    ></div>
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
                  <span>Booking Status:</span>
                  <Badge className={getStatusBadge(booking.status)}>
                    {booking.status.charAt(0).toUpperCase() +
                      booking.status.slice(1).replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Payment Status:</span>
                  <Badge className={getStatusBadge(booking.payment_status)}>
                    {!booking.payment_status
                      ? "Pending"
                      : booking.payment_status.charAt(0).toUpperCase() +
                        booking.payment_status.slice(1)}
                  </Badge>
                </div>
                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Stalls Booked</h4>
                  {booking.booking_stalls?.map((bs) => (
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

export default BookingConfirmation;
