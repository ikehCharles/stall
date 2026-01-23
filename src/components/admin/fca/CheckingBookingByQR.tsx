import { Card, CardContent } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  Building,
  AlertCircle,
  CheckIcon,
  IdCard,
  RefreshCcw,
  Calendar,
  PoundSterling,
  Loader2,
  UndoDot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getKycStatusColor,
  getPaymentStatusBadge,
  getStatusBadge,
} from "@/components/shared/statuses";
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import {
  BookingWithStalls,
  useCheckInVendor,
  useUndoCheckInVendor,
} from "@/hooks/useBookings";
import { StallInstance } from "@/hooks/useStallInstances";
import { Market } from "@/hooks/useMarkets";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FCABookingModal } from "./FCABookingModal";
import { eachDayOfInterval, format, startOfDay } from "date-fns";
import { BookingDate, useBookingDates } from "@/hooks/useBookingDates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  useReconcileOfflineBooking,
  useSyncOfflineBooking,
} from "@/hooks/useOfflineBooking";
import { INTENT } from "@/lib/enums";
import {
  useAdminToggleAuthorizedBooking,
  useAdminToggleBooking,
} from "@/hooks/useAdminBookings";
import { ENV } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirmDialog";
import { toast } from "@/components/ui/sonner";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import CurrencyWrapper from "@/components/shared/currency";

interface CheckingBookingByQRProps {
  open;
  onOpenChange;
  bookingRes: UseMutationResult<BookingWithStalls, Error, string, unknown>;
  market: Market;
  invoiceUrl: string;
}

const CheckingBookingByQR: React.FC<CheckingBookingByQRProps> = (props) => {
  const { bookingRes, market, open, onOpenChange, invoiceUrl } = props;
  const confirm = useConfirm();
  const bookingDates = useBookingDates(market.id || "");
  const syncOffline = useSyncOfflineBooking();
  const reconcileOffline = useReconcileOfflineBooking();
  const toggleAuthorizedBooking = useAdminToggleAuthorizedBooking();
  const toggleBooking = useAdminToggleBooking();
  const checkInVendorBookingDate = useCheckInVendor();
  const undoCheckInVendorBookingDate = useUndoCheckInVendor();
  const [selectedOtherStall, setSelectedOtherStall] =
    useState<StallInstance | null>(null);

  const booking = useMemo(() => {
    if (!bookingRes.isSuccess) return null;

    return {
      ...bookingRes.data,
      //   status: 'completed',
      //   payment_status: 'success',
      isCurrentMarket: bookingRes.data.market_id === market.id,
    };
  }, [bookingRes.data, bookingRes.isSuccess, market.id]);

  // Get booked dates for the selected stall
  //   const getBookedDatesForStall = (stallId: string): Date[] => {
  //     if (!bookingDates.data || !market) return [];

  //     return bookingDates.data
  //       .filter((bd) => bd.stall_instance_id === stallId)
  //       .map((bd) => startOfDay(new Date(bd.booking_date)));
  //   };

  const handleProceedWithUnpaidInvoice = async () => {
    await syncOffline.mutateAsync();
    bookingRes.mutateAsync(booking.id);
  };

  const handleRefresh = async () => {
    await reconcileOffline.mutateAsync();
    bookingRes.mutateAsync(booking.id);
  };

  const handleApprove = async (booking: BookingWithStalls) => {
    const bookingId = booking.id;

    if (booking.status === "reserved" && !booking.payment_status) {
      await toggleBooking.mutate({ bookingId, intent: INTENT.CAPTURE });
      await handleProceedWithUnpaidInvoice();
      return;
    }

    if (ENV.PAYMENT_INTENT == INTENT.CAPTURE) {
      await toggleBooking.mutate({ bookingId, intent: INTENT.CAPTURE });
      await bookingRes.mutateAsync(bookingId);
      return;
    }

    if (ENV.PAYMENT_INTENT == INTENT.AUTHORIZE) {
      await toggleAuthorizedBooking.mutate({
        bookingId,
        intent: INTENT.CAPTURE,
      });
      await bookingRes.mutateAsync(bookingId);
      return;
    }

    // error message for unsupported intent
    toast.error("Unsupported payment intent configured.");
  };

  const handleDecline = async (booking: BookingWithStalls) => {
    const bookingId = booking.id;

    const declineInfo = {
      title: "Confirm Decline",
      description:
        "Are you sure you want to decline this booking? This action cannot be undone.",
      confirmText: "Decline Booking",
      cancelText: "Cancel",
      confirmClassName: "bg-red-600 hover:bg-red-700 text-white",
    };

    if (
      booking.status === "reserved" &&
      (!booking.payment_status || booking.payment_status === "pending")
    ) {
      const val = await confirm({
        ...declineInfo,
        description:
          "This booking is currently reserved with no payment or pending payment. Declining will void the booking. Are you sure you want to proceed?",
      });
      if (!val) return;
      await toggleBooking.mutate({ bookingId, intent: INTENT.VOID });
      await bookingRes.mutateAsync(bookingId);
      return;
    }

    if (ENV.PAYMENT_INTENT == INTENT.AUTHORIZE) {
      const val = await confirm({
        ...declineInfo,
        description:
          "This will void authorized payment and decline booking. Are you sure you want to proceed?",
      });
      if (!val) return;
      await toggleAuthorizedBooking.mutate({ bookingId, intent: INTENT.VOID });
      await bookingRes.mutateAsync(bookingId);
      return;
    }
    if (ENV.PAYMENT_INTENT == INTENT.CAPTURE) {
      const val = await confirm({
        ...declineInfo,
        description:
          "This will refund payment and decline booking. Are you sure you want to proceed?",
      });
      if (!val) return;
      await toggleBooking.mutate({ bookingId, intent: INTENT.REFUND });
      await bookingRes.mutateAsync(bookingId);
      return;
    }

    // error message for unsupported intent
    toast.error("Unsupported payment intent configured.");
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
    syncOffline.isPending ||
    toggleBooking.isPending ||
    toggleAuthorizedBooking.isPending ||
    reconcileOffline.isPending;

  const isCompletedPaid =
    booking?.isCurrentMarket &&
    booking?.status === "completed" &&
    booking.payment_status === "success";
  const isPendingPayment =
    booking?.isCurrentMarket &&
    booking?.status === "approved" &&
    booking.payment_status !== "success";
  const isPendingNoPaymentApproval =
    booking?.isCurrentMarket &&
    booking?.status === "reserved" &&
    booking.payment_status !== "success";

  const isPendingCaptureApproval =
    booking?.isCurrentMarket &&
    booking?.status === "pending" &&
    booking.payment_status === "success";

  const isPendingAuthorizedApproval =
    booking?.isCurrentMarket &&
    booking?.status === "reserved" &&
    booking.payment_status === "authorized";

  const isPendingApproval =
    isPendingCaptureApproval ||
    isPendingNoPaymentApproval ||
    isPendingAuthorizedApproval;

  const showDefault =
    booking?.isCurrentMarket &&
    !isCompletedPaid &&
    !isPendingPayment &&
    !isPendingApproval;

  return (
    <>
      <Dialog modal={true} open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-baseline md:items-center justify-between gap-2">
              <div className="flex flex-wrap items-start gap-2">
                <span>FCA Booking - {market.name} </span>
                {booking?.status !== 'pending' && (
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    - {booking?.invoice_number}
                  </a>
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
          {/* On Error */}
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
            <div className="space-y-4">
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">
                      Booking is attached to ({booking.markets.name}) and not
                      applicable to current market(
                      {market.name}).
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Handle cancelled bookings */}
          {booking?.status === "cancelled" && (
            <div className="space-y-4">
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive mt-1" />
                    <div className="text-sm text-destructive space-y-1">
                      <p>
                        This booking has been{" "}
                        <span className="font-medium">cancelled</span>.
                      </p>
                      <p>
                        You cannot proceed with actions like payment or
                        modifications for cancelled bookings.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Status Information */}
          {booking && (
            <div className="space-y-4">
              <Card className="border-gray-300">
                <CardContent className="pt-4 flex justify-between flex-wrap gap-2 items-center space-y-2">
                  {/* Status */}
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Status
                    </span>
                    <span className="text-sm font-semibold">
                      {getStatusBadge(booking.status)}
                    </span>
                  </div>

                  {/* Payment Status */}
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
            </div>
          )}
          {/* Vendor Information */}
          {booking && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap -mx-2 text-sm text-muted-foreground">
                    {/* Full Name */}
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Name</p>
                        <p>{booking.profiles?.full_name || "N/A"}</p>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Email</p>
                        <p>{booking.profiles?.email || "N/A"}</p>
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Phone</p>
                        <p>{booking.profiles?.phone_number || "N/A"}</p>
                      </div>
                    </div>

                    {/* Company */}
                    {booking.profiles?.company_name && (
                      <div className="w-full sm:w-1/2 px-2 mb-4 flex items-center gap-3">
                        <Building className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Company</p>
                          <p>{booking.profiles?.company_name}</p>
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
                            booking.profiles?.kyc_applications?.status ===
                            "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : booking.profiles?.kyc_applications?.status ===
                                "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {booking.profiles?.kyc_applications?.status || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Scenario A: Unpaid Invoice */}
          {isPendingPayment && (
            <div className="space-y-4">
              <Card className="border-orange-500 bg-orange-500/10">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertCircle className="h-5 w-5" />
                    <h4 className="font-semibold">Unpaid Invoice Found</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This vendor has an existing unpaid booking for this stall.
                  </p>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice:</span>
                      <span className="font-mono">
                        {booking.invoice_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Total Amount:
                      </span>
                      <span className="font-semibold">
                        <CurrencyWrapper amount={booking.total_amount} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Outstanding:
                      </span>
                      <span className="font-semibold text-orange-700 dark:text-orange-400">
                        
                        <CurrencyWrapper amount={booking.total_amount - booking.paid_amount} />
                       
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      Booking Dates by Stall:
                    </p>

                    {booking.booking_stalls.map((stall) => {
                      const datesForStall = booking.booking_dates?.filter(
                        (d) => d.stall_instance_id === stall.stall_instances.id
                      );

                      if (!datesForStall?.length) return null;

                      return (
                        <div
                          key={stall.stall_instances.id}
                          className="space-y-1"
                        >
                          <p className="font-medium text-sm">
                            {stall.stall_instances.label}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {datesForStall.map((d) => (
                              <Badge key={d.id} variant="secondary">
                                <Calendar className="h-3 w-3 mr-1" />
                                {format(
                                  new Date(d.booking_date),
                                  "MMM d, yyyy"
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {!booking.offline_invoice_id && (
                <Button
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                  onClick={handleProceedWithUnpaidInvoice}
                >
                  {syncOffline.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <PoundSterling className="h-4 w-4 mr-2" />
                  Sync Payment
                </Button>
              )}

              {booking.offline_invoice_id && (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={reconcileOffline.isPending}
                  onClick={handleRefresh}
                >
                  {reconcileOffline.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Refresh
                </Button>
              )}
            </div>
          )}

          {/* Condition: Status = completed & Payment_status = success */}
          {/* Action: Show list of stalls with associated dates and a button to toggle check ins and out */}

          {isCompletedPaid && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-2">Daily Check-In</h3>

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
                              {/* check-in button */}
                              <Button
                                size="sm"
                                variant={
                                  d.checked_in_at ? "outline" : "default"
                                }
                                disabled={!!d.checked_in_at}
                                onClick={() =>
                                  toggleCheckin({
                                    ...d,
                                    booking_id: booking.id,
                                  })
                                }
                              >
                                {d.checked_in_at ? "Checked-In" : "Check-In"}
                              </Button>
                              {/* undo-check-in button */}
                              <PermissionGate
                                permissions={[
                                  PERMISSIONS.BOOKINGS.UNDO_CHECKIN,
                                ]}
                              >
                                {d.checked_in_at && (
                                  <Button
                                    size="sm"
                                    variant={"outline"}
                                    onClick={() =>
                                      toggleCheckin({
                                        ...d,
                                        booking_id: booking.id,
                                      })
                                    }
                                  >
                                    <UndoDot className="w-4 h-4" /> Check-In
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

          {/* Condition: Status === reserved && !payment_status */}
          {/* Action: Show table like design of stalls with associated dates and prices with a total amount at the bottom and then buttons to approve or reject (show both actions) */}

          {isPendingApproval && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-2">
                Pending Booking Review
              </h3>

              {/* Table-like layout */}
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
                                {format(
                                  new Date(d.booking_date),
                                  "MMM d, yyyy"
                                )}
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

                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total:</span>
                    <span>
                      <CurrencyWrapper amount={booking.total_amount} />
                      </span>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  disabled={isLoading}
                  onClick={() => handleApprove(booking)}
                  size="lg"
                  className="flex-1"
                  variant="default"
                >
                  {(toggleAuthorizedBooking.isPending ||
                    syncOffline.isPending ||
                    toggleBooking.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
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
                  {(toggleAuthorizedBooking.isPending ||
                    toggleBooking.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Decline Booking
                </Button>
              </div>
            </div>
          )}

          {/* Condition: Default State */}
          {/* Action: Show table like design of stalls with associated dates and prices with a total amount at the bottom and then button link to invoice */}

          {/* Condition: Default State */}
          {showDefault && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-2">Booking Summary</h3>
              {/* Alert text */}
              {booking.status !== "cancelled" && (
                <div className="flex items-center gap-2 justify-center text-yellow-700 dark:text-yellow-400 text-sm font-bold">
                  <AlertCircle className="h-4 w-4" />
                  <span>Vendor action required</span>
                </div>
              )}

              {/* Table-like layout */}
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
                                {format(
                                  new Date(d.booking_date),
                                  "MMM d, yyyy"
                                )}
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

                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total:</span>
                    <span>
                    <CurrencyWrapper amount={booking.total_amount} />
                      </span>
                  </div>
                </CardContent>
              </Card>

              {booking?.status !== "pending" && (
                <Button asChild size="lg" className="w-full">
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    View Invoice
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckingBookingByQR;
