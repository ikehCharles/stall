import {
  useParams,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookingWithStalls,
  useBookingDetails,
  useCancelBooking,
  useExpireBooking,
  useReserveBooking,
} from "@/hooks/useBookings";
import { useBookingDatesForBooking } from "@/hooks/useBookingDatesForBooking";
import { useStallInstances } from "@/hooks/useStallInstances";
import { PaymentModal } from "@/components/vendor/PaymentModal";
import { BookingHoldTimer } from "@/components/vendor/BookingHoldTimer";
// import { useAdminApproveBooking, useAdminDeclineBooking } from "@/hooks/useAdminBookings";
import { parseISO, format, differenceInCalendarDays } from "date-fns";
import { Check, Loader, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ENV, PAYMENT_SWITCH_ENUM, generateInvoiceUrl } from "@/lib/utils";
import { useCreatePayment } from "@/hooks/use-payment";
import { INTENT } from "@/lib/enums";
import {
  useAdminBookings,
  useAdminToggleAuthorizedBooking,
  useAdminToggleBooking,
} from "@/hooks/useAdminBookings";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipContent } from "@radix-ui/react-tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import React from "react";
import CurrencyWrapper from "@/components/shared/currency";

const BookingDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { data: booking, isLoading, error } = useBookingDetails(id || "");
  const { data: bookingDates = [] } = useBookingDatesForBooking(id || "");
  const { data: allStalls = [] } = useStallInstances(booking?.market_id || "");
  const toggleBooking = useAdminToggleBooking();
  const toggleAuthorizedBooking = useAdminToggleAuthorizedBooking();
  const cancelBooking = useCancelBooking();
  const reserveBooking = useReserveBooking();
  const expireBooking = useExpireBooking();
  const createPayment = useCreatePayment();
  const isAdminView = location.pathname.includes("/admin/");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [invoiceQR, setInvoiceQR] = useState<string | null>(null);
  const hasAttemptedExpireFor = useRef<string | null>(null);

  // look for search params status=processing and set dependency on payment_status, if it changes to success, remove search param
  useEffect(() => {
    if (searchParams.get("status") === "processing") {
      setIsProcessingPayment(true);
      if (booking?.payment_status === "success") {
        navigate(`/vendor/bookings/${id}`);
        setIsProcessingPayment(false);
      }
    }
  }, [booking?.payment_status, id, navigate, searchParams]);

  // On load (and refresh): if hold has passed and booking is unpaid and not already expired, call expire_booking once to set status to 'expired'
  useEffect(() => {
    if (
      !booking?.id ||
      booking.status === "expired" ||
      booking.payment_status === "success" ||
      booking.payment_status === "authorized" ||
      !booking.hold_expires_at
    )
      return;
    if (new Date(booking.hold_expires_at) > new Date()) return;
    if (hasAttemptedExpireFor.current === booking.id) return;
    hasAttemptedExpireFor.current = booking.id;
    expireBooking.mutate(booking.id);
  }, [booking?.id, booking?.status, booking?.payment_status, booking?.hold_expires_at]); // eslint-disable-line react-hooks/exhaustive-deps -- expireBooking omitted to avoid loop when mutation state updates

  const canShowActions = useCallback((booking: BookingWithStalls) => {
    const { status, payment_status } = booking;
    // reserved & authorized, INTENT = AUTHORIZED (on authorized charge account) OR INTENT = PAY LATER - (Approve and sync with POS)
    if (status === "reserved") {
      return true;
    }
    // INTENT = CAPTURE
    if (status === "pending" && payment_status === "success") {
      return true;
    }
    return false;
  }, []);

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

  if (error || !booking) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Booking not found</h2>
        <p className="text-muted-foreground mt-2">
          The booking you're looking for could not be found.
        </p>
        <Button asChild className="mt-4">
          <Link to={isAdminView ? "/admin/bookings" : "/vendor/bookings"}>
            Back to Bookings
          </Link>
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

    // Parse all dates to ISO and sort chronologically
    const parsedDates = dates
      .map((d) => parseISO(d)) // parse ISO string safely
      .sort((a, b) => a.getTime() - b.getTime());

    const formattedDates = parsedDates.map((d) => format(d, "MMM d"));

    if (formattedDates.length <= 3) {
      return formattedDates.join(", ");
    }

    // Group consecutive dates
    const groups: string[] = [];
    let start = 0;

    for (let i = 1; i <= parsedDates.length; i++) {
      if (
        i === parsedDates.length ||
        differenceInCalendarDays(parsedDates[i], parsedDates[i - 1]) > 1
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

  const isPaymentAvailable =
    booking &&
    booking.status === "pending" && // Admin approves later
    (!booking.payment_status || ["failed"].includes(booking.payment_status)) &&
    booking.paid_amount < booking.total_amount &&
    (!booking.hold_expires_at ||
      new Date(booking.hold_expires_at) > new Date());

  const isCancellable =
    booking &&
    ["approved"].includes(booking.status) &&
    booking.payment_status !== "success";

  const bookedStallIds =
    booking?.booking_stalls?.map((bs) => bs.stall_instance_id) || [];

  const handleCancelBooking = async () => {
    if (!id) return;
    try {
      await cancelBooking.mutateAsync(id);
      toast.success("Booking cancelled successfully");
      setCancelDialogOpen(false);
      navigate("/vendor/bookings");
    } catch (error) {
      toast.error(error.message || "Failed to cancel booking");
      console.error("Error cancelling booking:", error);
    }
  };

  const handleReserveBooking = async () => {
    if (!id) return;
    try {
      await reserveBooking.mutateAsync(id);
      toast.success("Booking reserved successfully");
      setCancelDialogOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to reserve booking");
      console.error("Error reserving booking:", error);
    }
  };

  const makePayment = () => {
    if (ENV.PAYMENT_SWITCH === PAYMENT_SWITCH_ENUM.SIMULATION) {
      setPaymentModalOpen(true);
      return;
    }
    createPayment.mutate({
      bookingId: booking.id,
      amount: booking.total_amount,
      intent:
        ENV.PAYMENT_INTENT === INTENT.AUTHORIZE
          ? INTENT.AUTHORIZE
          : INTENT.CAPTURE,
    });
  };

  const handleApprove = (bookingId: string) => {
    if (ENV.PAYMENT_INTENT == INTENT.AUTHORIZE) {
      toggleAuthorizedBooking.mutate({ bookingId, intent: INTENT.CAPTURE });
      return;
    }
    if (ENV.PAYMENT_INTENT == INTENT.CAPTURE) {
      toggleBooking.mutate({ bookingId, intent: INTENT.CAPTURE });
      return;
    }

    // error message for unsupported intent
    toast.error("Unsupported payment intent configured.");
  };

  const handleDecline = (bookingId: string) => {
    if (ENV.PAYMENT_INTENT == INTENT.AUTHORIZE) {
      toggleAuthorizedBooking.mutate({ bookingId, intent: INTENT.VOID });
      return;
    }
    if (ENV.PAYMENT_INTENT == INTENT.CAPTURE) {
      toggleBooking.mutate({ bookingId, intent: INTENT.VOID });
      return;
    }

    // error message for unsupported intent
    toast.error("Unsupported payment intent configured.");
  };

  const generateQR = async () => {
    const url = generateInvoiceUrl(booking.id);
    const qr = await QRCode.toDataURL(url);
    setInvoiceQR(qr);
  };

  return (
    <>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Button asChild variant="ghost" className="mb-4 ml-0 pl-0">
              <Link to={isAdminView ? "/admin/bookings" : "/vendor/bookings"}>
                ← Back to Bookings
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Booking Details</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              {booking.markets?.name}
            </p>
          </div>
          <div className="space-x-2 flex items-center justify-end flex-wrap gap-2">
            <Button onClick={generateQR} variant="outline">
              <QrCode />
              View QR
            </Button>

            {!isAdminView && (
              <Button asChild variant="outline">
                <Link to={`/vendor/invoice/${booking.id}`}>View Invoice</Link>
              </Button>
            )}

            {!isAdminView && isPaymentAvailable && (
              <div className="flex items-center flex-wrap gap-2">
                <Button
                  disabled={
                    isProcessingPayment ||
                    reserveBooking.isPending ||
                    createPayment.isPending
                  }
                  onClick={makePayment}
                >
                  {isProcessingPayment ? (
                    "Processing Payment..."
                  ) : createPayment.isPending ? (
                    <>
                      <Loader className="animate-spin" /> Make Payment
                    </>
                  ) : (
                    "Make Payment"
                  )}
                </Button>
              </div>
            )}
            {!isAdminView && isCancellable && !isProcessingPayment && (
              <Button
                onClick={() => setCancelDialogOpen(true)}
                variant="destructive"
              >
                Cancel Booking
              </Button>
            )}
            {isAdminView && canShowActions(booking) && (
              <>
                <Button
                  onClick={() => handleApprove(booking.id)}
                  disabled={
                    toggleAuthorizedBooking.isPending || toggleBooking.isPending
                  }
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDecline(booking.id)}
                  disabled={
                    toggleAuthorizedBooking.isPending || toggleBooking.isPending
                  }
                >
                  <X className="w-4 h-4 mr-1" />
                  Decline
                </Button>
              </>
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
                    <p className="text-lg">
                      {formatBookingDates(booking.selected_dates)}
                    </p>
                  </div>
                </div>

                {booking.hold_expires_at &&
                  booking.status !== "expired" &&
                  booking.payment_status !== "success" && (
                    <div className="pt-2">
                      <BookingHoldTimer
                        bookingId={booking.id}
                        expiresAt={booking.hold_expires_at}
                      />
                    </div>
                  )}
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
                        <span>
                          <CurrencyWrapper amount={bs.price_at_booking} />
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between font-medium">
                      <span>Total Amount:</span>
                      <span>
                        <CurrencyWrapper amount={booking.total_amount} />
                      </span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Paid:</span>
                      <span>
                      <CurrencyWrapper amount={booking.paid_amount} />
                      </span>
                    </div>
                    {booking.paid_amount < booking.total_amount && (
                      <div className="flex justify-between text-red-600 font-medium">
                        <span>Outstanding:</span>
                        <span>
                          <CurrencyWrapper amount={booking.total_amount - booking.paid_amount} />
                      
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Payment Modal - only show for vendors */}
        {booking && !isAdminView && (
          <PaymentModal
            booking={booking}
            isOpen={paymentModalOpen}
            onClose={() => setPaymentModalOpen(false)}
          />
        )}

        {/* Cancel Booking Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this booking? This action cannot
                be undone. All reserved stalls and dates will be released.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Booking</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelBooking}
                className="bg-red-600 hover:bg-red-700"
              >
                Cancel Booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog
        modal={true}
        open={!!invoiceQR}
        onOpenChange={(open) => setInvoiceQR("")}
      >
        <DialogContent className="max-w-xs max-h-[80vh] overflow-y-auto">
          <div className="flex justify-center items-center">
            <img src={invoiceQR} alt="Invoice QR Code" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BookingDetails;
