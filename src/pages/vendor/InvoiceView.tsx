import { useParams, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useBookingDetails } from "@/hooks/useBookings";
import { BookingHoldTimer } from "@/components/vendor/BookingHoldTimer";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getPaymentStatusBadge } from "@/components/shared/statuses";
import CurrencyWrapper from "@/components/shared/currency";
import VatBreakdown from "@/components/shared/VatBreakdown";
import { usePlatformSettings } from "@/hooks/useSettings";
import { APP_NAME_DEFAULT } from "@/lib/appBranding";

const InvoiceView = () => {
  const { id } = useParams();
  const location = useLocation();
  const { data: booking, isLoading, error } = useBookingDetails(id || "");
  const { data: platformSettings } = usePlatformSettings();
  const appName = platformSettings?.appName || APP_NAME_DEFAULT;
  const isAdminView = location.pathname.includes("/admin/");

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground">
          Invoice not found
        </h2>
        <Button asChild className="mt-4">
          <Link to="/vendor/bookings">Back to Bookings</Link>
        </Button>
      </div>
    );
  }

  const totalAmount = booking.total_amount || 0;
  const paidAmount = booking.paid_amount || 0;
  const grossAmount = booking.gross_amount ?? totalAmount;
  const outstandingAmount = grossAmount - paidAmount;

  return (
    <div className="max-w-4xl mx-auto overflow-auto space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          {!isAdminView && (
            <Button asChild variant="ghost">
              <Link to="/vendor/bookings">← Back to Bookings</Link>
            </Button>
          )}
        </div>
        <div className="space-x-2">
          <Button variant="outline" onClick={handlePrint}>
            Print Invoice
          </Button>
        </div>
      </div>
      <div className=" w-[90vw] md:w-[60vw] lg:w-full mx-auto flex lg:justify-center overflow-scroll">
        <Card className=" w-[700px] shadow-lg print:shadow-none">
          <CardContent className="p-8">
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {appName}
                </h1>
                <p className="text-muted-foreground mt-1">
                  Marketplace Management Platform
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-foreground">INVOICE</h2>
                <p className="text-muted-foreground">
                  #{booking.invoice_number}
                </p>
                <p className="text-muted-foreground">
                  Date: {format(new Date(booking.created_at), "PPP")}
                </p>
                <div className="mt-2 print:hidden">
                  <BookingHoldTimer
                    hideBadge={true}
                    bookingId={booking.id}
                    expiresAt={booking.hold_expires_at}
                    bookingStatus={booking.status}
                    paymentStatus={booking.payment_status}
                  />
                </div>
              </div>
            </div>

            <Separator className="mb-8" />

            {/* Billing Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold mb-3">Bill To:</h3>
                <div className="space-y-1">
                  <p className="font-medium">
                    {booking.profile?.full_name || "Vendor"}
                  </p>
                  <p className="text-muted-foreground">
                    {booking.profile?.email}
                  </p>
                  {booking.profile?.phone_number && (
                    <p className="text-muted-foreground">
                      {booking.profile.phone_number}
                    </p>
                  )}
                  {booking.profile?.company_name && (
                    <p className="text-muted-foreground">
                      {booking.profile.company_name}
                    </p>
                  )}
                  {booking.profile?.address && (
                    <p className="text-muted-foreground">
                      {booking.profile.address}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Event Details:</h3>
                <div className="space-y-1">
                  <p className="font-medium">
                    {booking.markets?.name || "Market Event"}
                  </p>
                  <p className="text-muted-foreground">
                    Start Date:{" "}
                    {booking.markets?.start_at
                      ? format(new Date(booking.markets.start_at), "PPP")
                      : "N/A"}
                  </p>
                  <p className="text-muted-foreground">
                    End Date:{" "}
                    {booking.markets?.end_at
                      ? format(new Date(booking.markets.end_at), "PPP")
                      : "N/A"}
                  </p>
                  <p className="text-muted-foreground">
                    Theme: {booking.markets?.theme || "Default"}
                  </p>
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Booking Details:</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Stall</th>
                      <th className="text-left whitespace-nowrap py-3 px-4 font-medium">
                        Selected Dates
                      </th>
                      <th className="text-right py-3 px-4 font-medium">Days</th>
                      <th className="text-right py-3 px-4 font-medium">
                        Price/Day
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.booking_stalls?.map((bs) => {
                      const stallDates =
                        booking.booking_dates?.filter(
                          (bd) => bd.stall_instance_id === bs.stall_instance_id
                        ) || [];
                      const daysCount = stallDates.length;
                      const pricePerDay = bs.price_at_booking || 0;
                      const subtotal = pricePerDay * daysCount;

                      return (
                        <tr key={bs.id} className="border-t">
                          <td className="py-3 px-4 whitespace-nowrap font-medium">
                            Stall {bs.stall_instances?.label || "N/A"}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {stallDates.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {stallDates.map((bd) => (
                                  <span
                                    key={bd.id}
                                    className="text-xs bg-muted px-2 py-1 rounded"
                                  >
                                    {format(new Date(bd.booking_date), "MMM d")}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              "No dates selected"
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">{daysCount}</td>
                          <td className="py-3 px-4 text-right">
                            <CurrencyWrapper amount={pricePerDay} />
                          
                          </td>
                          <td className="py-3 px-4 text-right">
                            <CurrencyWrapper amount={subtotal} />
                           
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="border-t pt-6">
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <VatBreakdown booking={booking} />
                  <div className="flex justify-between text-green-600">
                    <span>Paid:</span>
                    <span><CurrencyWrapper amount={paidAmount} /></span>
                  </div>
                  {outstandingAmount > 0 && (
                    <div className="flex justify-between text-destructive font-medium">
                      <span>Outstanding:</span>
                      <span><CurrencyWrapper amount={outstandingAmount} /></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Status Badge */}
            <div className="mt-6 flex justify-end">
              <div className={`pl-4 py-2 text-sm font-medium`}>
                Payment Status: {getPaymentStatusBadge(booking.payment_status)}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t text-center text-muted-foreground">
              <p>Thank you for your business!</p>
              <p className="text-sm mt-2">
                For questions about this invoice, contact us at
                support@stallinc.com
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InvoiceView;
