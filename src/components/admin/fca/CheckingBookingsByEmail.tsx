import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  Building,
  IdCard,
  Calendar,
  Package,
} from "lucide-react";
import {
  getPaymentStatusBadge,
  getStatusBadge,
} from "@/components/shared/statuses";
import { Market } from "@/hooks/useMarkets";
import { Button } from "@/components/ui/button";
import {
  eachDayOfInterval,
  format,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { UserBookingsResponse } from "@/hooks/useVendorLookup";
import CurrencyWrapper from "@/components/shared/currency";


interface CheckingBookingsByEmailProps {
  open;
  onOpenChange;
  bookingsWithprofile: UserBookingsResponse | null;
  market: Market;
  onSelectBooking: (booking: UserBookingsResponse["bookings"][0]) => void;
}

// Helper: Format date nicely
const formatBookingDate = (dateStr: string): string => {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM dd, yyyy");
};

const CheckingBookingsByEmail: React.FC<CheckingBookingsByEmailProps> = (
  props
) => {
  const { bookingsWithprofile, open, onOpenChange, market, onSelectBooking } =
    props;
  const { bookings, profile } = bookingsWithprofile;

  return (
    <>
      <Dialog modal={true} open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-baseline md:items-center justify-between gap-2">
              <div className="flex flex-wrap items-start gap-2">
                <span>FCA Booking - {market.name} </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Vendor Information */}
          {profile && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap -mx-2 text-sm text-muted-foreground">
                    {/* Full Name */}
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Name</p>
                        <p>{profile.full_name || "N/A"}</p>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Email</p>
                        <p>{profile.email || "N/A"}</p>
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Phone</p>
                        <p>{profile.phone_number || "N/A"}</p>
                      </div>
                    </div>

                    {/* Company */}
                    {profile.company_name && (
                      <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                        <Building className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Company</p>
                          <p>{profile.company_name}</p>
                        </div>
                      </div>
                    )}

                    {/* KYC Status */}
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <IdCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">
                          KYC Status
                        </p>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            profile.kyc_status === "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : profile.kyc_status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {profile.kyc_status || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <h2 className="text-lg font-semibold text-center">All Bookings</h2>

          {!bookings?.length && (
            <div className="max-w-4xl mx-auto">
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                  {/* Icon */}
                  <div className="rounded-full bg-muted p-6">
                    <Calendar className="w-12 h-12 text-muted-foreground" />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">
                      No bookings yet
                    </h3>
                    <p className="text-sm text-muted-foreground max1-w-sm">
                      When you book a market stall, your reservations will
                      appear here.
                    </p>
                  </div>

                  {/* Optional CTA */}
                  <Button>
                    <Package className="w-4 h-4" />
                    Browse Available Stalls
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Status Information */}
          {!!bookings?.length &&
            bookings.map((booking) => {
              return (
                <div key={booking.id} className="space-y-4">
                  <Card
                    onClick={() => onSelectBooking(booking)}
                    className="border-border cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <CardContent className="space-y-4">
                      <div className="pb-3">
                        <div className="flex justify-between pt-4 pb-0 items-start">
                          <div className="text-lg font-semibold">
                            {booking.invoice_number}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              Total
                            </p>
                            <p className="text-lg font-bold">
                              <CurrencyWrapper amount={booking.gross_amount ?? booking.total_amount} />
                            </p>
                            {booking.paid_amount > 0 &&
                              booking.paid_amount < (booking.gross_amount ?? booking.total_amount) && (
                                <p className="text-xs text-green-600">
                                  <CurrencyWrapper amount={booking.paid_amount} /> paid
                                </p>
                              )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Dates */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Dates
                        </span>
                        {!!booking.selected_dates.length && (
                          <span className="text-sm font-medium text-right max-w-[60%]">
                            {booking.selected_dates
                              .map(formatBookingDate)
                              .join(" → ")}
                          </span>
                        )}
                      </div>

                      {/* Status Row */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Status
                        </span>
                        {getStatusBadge(booking.status)}
                      </div>

                      {/* Payment Status Row */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Payment
                        </span>
                        {getPaymentStatusBadge(booking.payment_status)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckingBookingsByEmail;
