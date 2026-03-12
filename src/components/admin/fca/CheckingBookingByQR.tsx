import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  Building,
  AlertCircle,
  IdCard,
  RefreshCcw,
  Calendar,
  PoundSterling,
  Loader2,
  UndoDot,
} from "lucide-react";
import {
  getPaymentStatusBadge,
  getStatusBadge,
} from "@/components/shared/statuses";
import { UseMutationResult } from "@tanstack/react-query";
import {
  BookingWithStalls,
  useCancelBooking,
  useCheckInVendor,
  useUndoCheckInVendor,
} from "@/hooks/useBookings";
import { Market } from "@/hooks/useMarkets";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { INTENT } from "@/lib/enums";
import {
  useAdminCancelBookingRpc,
  useAdminToggleAuthorizedBooking,
  useAdminToggleBooking
} from "@/hooks/useAdminBookings";
import { ENV } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirmDialog";
import { toast } from "@/components/ui/sonner";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import CurrencyWrapper from "@/components/shared/currency";
import { BookingHoldTimer } from "@/components/vendor/BookingHoldTimer";

interface CheckingBookingByQRProps {
  open;
  onOpenChange;
  bookingRes: UseMutationResult<BookingWithStalls, Error, string, unknown>;
  market: Market;
  invoiceUrl: string;
  onBookingUpdated?: () => void;
}

const CheckingBookingByQR: React.FC<CheckingBookingByQRProps> = (props) => {
  const { bookingRes, market, open, onOpenChange, invoiceUrl, onBookingUpdated } = props;
  const confirm = useConfirm();
  const toggleAuthorizedBooking = useAdminToggleAuthorizedBooking();
  const toggleBooking = useAdminToggleBooking();
  const declineBooking = useAdminCancelBookingRpc();
  const checkInVendorBookingDate = useCheckInVendor();
  const undoCheckInVendorBookingDate = useUndoCheckInVendor();

  const booking = useMemo(() => {
    if (!bookingRes.isSuccess) return null;

    return {
      ...bookingRes.data,
      isCurrentMarket: bookingRes.data.market_id === market.id,
    };
  }, [bookingRes.data, bookingRes.isSuccess, market.id]);

  const handleApprove = async (booking: BookingWithStalls) => {
    const bookingId = booking.id;

    if (ENV.PAYMENT_INTENT == INTENT.CAPTURE) {
      await toggleBooking.mutateAsync({ bookingId, intent: INTENT.CAPTURE });
      await bookingRes.mutateAsync(bookingId);
      onBookingUpdated?.();
      return;
    }

    if (ENV.PAYMENT_INTENT == INTENT.AUTHORIZE) {
      await toggleAuthorizedBooking.mutateAsync({
        bookingId,
        intent: INTENT.CAPTURE,
      });
      await bookingRes.mutateAsync(bookingId);
      onBookingUpdated?.();
      return;
    }

    toast.error("Unsupported payment intent configured.");
  };

  const handleDecline = async (booking: BookingWithStalls) => {
    const val = await confirm({
      title: "Confirm Decline",
      description:
        "Are you sure you want to decline this booking? Any payment will be refunded accordingly. This action cannot be undone.",
      confirmText: "Decline Booking",
      cancelText: "Cancel",
      confirmClassName: "bg-red-600 hover:bg-red-700 text-white",
    });
    if (!val) return;

    await declineBooking.mutateAsync(booking.id);
    await bookingRes.mutateAsync(booking.id);
    onBookingUpdated?.();
  };

  const toggleCheckin = async (
    checkin: BookingWithStalls["booking_dates"][0] & { booking_id: string }
  ) => {
    const togglePromptInfo = {
      title: "Confirm Action",
      description:
        "Are you sure you want to proceed? This action cannot be undone.",
      confirmText: "Proceed",
      cancelText: "Cancel",
      confirmClassName: "bg-red-600 hover:bg-red-700 text-white",
    };

    const id = checkin.id;

    if (!checkin.checked_in_at) {
      const val = await confirm({
        ...togglePromptInfo,
        title: "Check in Vendor",
        confirmClassName: "bg-green-600 hover:bg-green-700 text-white",
      });
      if (!val) return;
      await checkInVendorBookingDate.mutateAsync({
        bookingDateId: id,
        bookingId: checkin.booking_id,
      });
      await bookingRes.mutateAsync(checkin.booking_id);
    } else {
      const val = await confirm({
        ...togglePromptInfo,
        title: "Undo Check in Vendor",
      });
      if (!val) return;
      await undoCheckInVendorBookingDate.mutateAsync({
        bookingDateId: id,
        bookingId: checkin.booking_id,
      });
      await bookingRes.mutateAsync(checkin.booking_id);
    }
  };

  const isLoading =
    bookingRes.isPending ||
    toggleBooking.isPending ||
    toggleAuthorizedBooking.isPending ||
    declineBooking.isPending;

  // --- Flow conditions ---
  const needsPayment =
    booking?.isCurrentMarket &&
    booking?.status !== "cancelled" &&
    booking?.status !== "expired" &&
    booking?.payment_status !== "success";

  const paidButPendingApproval =
    booking?.isCurrentMarket &&
    booking?.payment_status === "success" &&
    booking?.status !== "completed" &&
    booking?.status !== "cancelled";

  const isCompletedPaid =
    booking?.isCurrentMarket &&
    booking?.status === "completed" &&
    booking?.payment_status === "success";

  return (
    <>
      <Dialog modal={true} open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-baseline md:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>FCA Booking - {market.name} </span>
                {booking?.invoice_number && (
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    - {booking.invoice_number}
                  </a>
                )}
                {booking && (
                  <BookingHoldTimer
                    bookingId={booking.id}
                    expiresAt={booking.hold_expires_at}
                    bookingStatus={booking.status}
                    paymentStatus={booking.payment_status}
                    onExpired={() => {
                      bookingRes.mutateAsync(booking.id);
                      onBookingUpdated?.();
                    }}
                  />
                )}
              </div>

              {booking && (
                <Button
                  onClick={() => bookingRes.mutateAsync(booking.id)}
                  variant="ghost"
                >
                  <RefreshCcw /> Refresh
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Error */}
          {bookingRes.isError && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">
                    Failed to find booking. Please try again.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Not in current market */}
          {booking && !booking.isCurrentMarket && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">
                    Booking is attached to ({booking.markets.name}) and not
                    applicable to current market ({market.name}).
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancelled */}
          {booking?.status === "cancelled" && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-1" />
                  <div className="text-sm text-destructive space-y-1">
                    <p>
                      This booking has been{" "}
                      <span className="font-medium">cancelled</span>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status + Payment badges */}
          {booking && (
            <Card className="border-gray-300">
              <CardContent className="pt-4 flex justify-between flex-wrap gap-2 items-center space-y-2">
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Status
                  </span>
                  <span className="text-sm font-semibold">
                    {getStatusBadge(booking.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Payment Status
                  </span>
                  <span className="text-sm font-semibold">
                    {getPaymentStatusBadge(booking.payment_status)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vendor Information */}
          {booking && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap -mx-2 text-sm text-muted-foreground">
                  <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Name</p>
                      <p>{booking.profile?.full_name || "N/A"}</p>
                    </div>
                  </div>
                  <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Email</p>
                      <p>{booking.profile?.email || "N/A"}</p>
                    </div>
                  </div>
                  <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Phone</p>
                      <p>{booking.profile?.phone_number || "N/A"}</p>
                    </div>
                  </div>
                  {booking.profile?.company_name && (
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Company</p>
                        <p>{booking.profile.company_name}</p>
                      </div>
                    </div>
                  )}
                  <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                    <IdCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">KYC Status</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          booking.profile?.kyc_application?.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : booking.profile?.kyc_application?.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {booking.profile?.kyc_application?.status || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Booking Summary — shown for all current-market non-cancelled bookings */}
          {booking?.isCurrentMarket && booking.status !== "cancelled" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {booking.booking_stalls.map((bs) => {
                    const datesForStall = booking.booking_dates?.filter(
                      (d) => d.stall_instance_id === bs.stall_instances.id
                    );

                    return (
                      <div
                        key={bs.stall_instances.id}
                        className="border-b last:border-none pb-4"
                      >
                        <div className="font-medium mb-2">
                          Stall: {bs.stall_instances.label} —{" "}
                          {bs.stall_instances.stall_templates.name}
                        </div>
                        <ul className="space-y-1 text-sm">
                          {datesForStall?.map((d) => (
                            <li
                              key={d.id}
                              className="flex justify-between text-muted-foreground"
                            >
                              <span>
                                {format(new Date(d.booking_date), "MMM d, yyyy")}
                              </span>
                              <span>
                                <CurrencyWrapper amount={booking.price_per_day} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  <Separator />

                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>
                      <CurrencyWrapper amount={booking.total_amount} />
                    </span>
                  </div>

                  {booking.vat_amount != null && booking.vat_amount > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>VAT:</span>
                      <span>
                        <CurrencyWrapper amount={booking.vat_amount} />
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total:</span>
                    <span>
                      <CurrencyWrapper amount={booking.gross_amount ?? booking.total_amount} />
                    </span>
                  </div>

                  {booking.paid_amount > 0 && needsPayment && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Outstanding:</span>
                      <span className="font-semibold text-orange-600">
                        <CurrencyWrapper amount={(booking.gross_amount ?? booking.total_amount) - booking.paid_amount} />
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ============================================ */}
              {/* 1) No payment → Go to Payment (FCA Checkout) */}
              {/* ============================================ */}
              {needsPayment && (
                <Button
                  className="w-full"
                  size="lg"
                  asChild
                >
                  <a
                    href={`/admin/fca/checkout?bookingId=${booking.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Go to Payment
                  </a>
                </Button>
              )}

              {/* ============================================ */}
              {/* 2) Paid but pending/reserved → Approve/Decline */}
              {/*    or "Awaiting Review" if no permission       */}
              {/* ============================================ */}
              {paidButPendingApproval && (
                <PermissionGate
                  permissions={[PERMISSIONS.BOOKINGS.MANAGE]}
                  fallback={
                    <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-pulse" />
                      <span className="text-sm font-medium">Awaiting Review</span>
                    </div>
                  }
                >
                  <div className="flex gap-2">
                    <Button
                      disabled={isLoading}
                      onClick={() => handleApprove(booking)}
                      size="lg"
                      className="flex-1"
                      variant="default"
                    >
                      {(toggleAuthorizedBooking.isPending ||
                        toggleBooking.isPending) && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Approve Booking
                    </Button>
                    <Button
                      disabled={isLoading}
                      onClick={() => handleDecline(booking)}
                      size="lg"
                      className="flex-1"
                      variant="destructive"
                    >
                      {declineBooking.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Decline Booking
                    </Button>
                  </div>
                </PermissionGate>
              )}

              {/* ============================================ */}
              {/* 3) Completed + Paid → Check-in for stalls     */}
              {/* ============================================ */}
              {isCompletedPaid && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Daily Check-In</h3>

                  {booking.booking_stalls.map((bs) => {
                    const datesForStall = booking.booking_dates?.filter(
                      (d) => d.stall_instance_id === bs.stall_instances.id
                    );

                    return (
                      <Card key={bs.stall_instances.id}>
                        <CardContent className="pt-6 space-y-4">
                          <div className="font-medium">
                            Stall: {bs.stall_instances.label} (
                            {bs.stall_instances.stall_templates.name})
                          </div>

                          <div className="space-y-2">
                            {datesForStall?.map((d) => (
                              <div
                                key={d.id}
                                className="flex justify-between items-baseline p-3 border rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {format(new Date(d.booking_date), "MMM d, yyyy")}
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant={d.checked_in_at ? "outline" : "default"}
                                    disabled={!!d.checked_in_at}
                                    onClick={() =>
                                      toggleCheckin({ ...d, booking_id: booking.id })
                                    }
                                  >
                                    {d.checked_in_at ? "Checked-In" : "Check-In"}
                                  </Button>
                                  {d.checked_in_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(d.checked_in_at), "MMM d, yyyy h:mm a")}
                                    </span>
                                  )}
                                  <PermissionGate
                                    permissions={[PERMISSIONS.BOOKINGS.UNDO_CHECKIN]}
                                  >
                                    {d.checked_in_at && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          toggleCheckin({ ...d, booking_id: booking.id })
                                        }
                                      >
                                        <UndoDot className="w-4 h-4" /> Undo
                                      </Button>
                                    )}
                                  </PermissionGate>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckingBookingByQR;
