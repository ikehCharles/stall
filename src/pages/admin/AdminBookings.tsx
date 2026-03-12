import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useAdminBookings,
  useAdminToggleBooking,
  useAdminToggleAuthorizedBooking,
  useCancelBooking,
  useRequestRefund,
  useApproveRefund,
  useRejectRefund,
} from "@/hooks/useAdminBookings";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader, X, RotateCcw, ShieldAlert, Eye, ShieldCheck, HandCoins, ShieldX } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { ENV } from "@/lib/utils";
import { INTENT } from "@/lib/enums";
import { toast } from "sonner";
import { BookingWithStalls } from "@/hooks/useBookings";
import { useConfirm } from "@/components/ui/confirmDialog";
import {
  useReconcileOfflineBooking,
  useSyncOfflineBooking,
} from "@/hooks/useOfflineBooking";
import {
  getPaymentStatusBadge,
  getRefundStatusBadge,
  getStatusBadge,
} from "@/components/shared/statuses";
import CurrencyWrapper from "@/components/shared/currency";
import { usePermissions } from "@/hooks/usePermissions";
import { RefundApprovalDialog } from "@/components/admin/RefundApprovalDialog";

const AdminBookings = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<"reject" | "request" | "approve" | "reject_refund">("reject");
  const [selectedBooking, setSelectedBooking] = useState<BookingWithStalls | null>(null);
  const confirm = useConfirm();
  const { hasPermission } = usePermissions();
  const { data: bookings, isLoading } = useAdminBookings();
  const toggleAuthorizedBooking = useAdminToggleAuthorizedBooking();
  const toggleBooking = useAdminToggleBooking();
  const cancelBooking = useCancelBooking();
  const requestRefund = useRequestRefund();
  const approveRefund = useApproveRefund();
  const rejectRefund = useRejectRefund();
  const syncOffline = useSyncOfflineBooking();
  const reconcileOffline = useReconcileOfflineBooking();

  const canApproveRefund = hasPermission(PERMISSIONS.REFUNDS.APPROVE);
  const canRequestRefund = hasPermission(PERMISSIONS.REFUNDS.REQUEST);
  const canManageBookings = hasPermission(PERMISSIONS.BOOKINGS.MANAGE);

  useEffect(() => {
    syncOffline.mutateAsync();
    reconcileOffline.mutateAsync();
  }, []);

  const filteredBookings =
    bookings?.filter((booking) => {
      const matchesSearch =
        booking.invoice_number
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        booking.markets?.name.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = true;
      if (statusFilter === "refund_requested") {
        matchesStatus = booking.refund_status === "requested";
      } else if (statusFilter !== "all") {
        matchesStatus = booking.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    }) || [];

  const pendingRefundCount = bookings?.filter(b => b.refund_status === "requested").length || 0;

  const handleApprove = async (booking: BookingWithStalls) => {
    const confirmInfo = {
      title: "Confirm Approval",
      description:
        "Are you sure you want to approve this booking? This action cannot be undone.",
      confirmText: "Approve Booking",
      cancelText: "Cancel",
      confirmClassName: "bg-green-600 hover:bg-green-700 text-white",
    };

    const bookingId = booking.id;

    if (booking.status === "reserved" && !booking.payment_status) {
      const val = await confirm({
        ...confirmInfo,
        description:
          "This booking is currently reserved with no payment. Approving only means payment can be collected later to complete booking. Are you sure you want to proceed?",
      });
      if (!val) return;
      toggleBooking.mutate({ bookingId, intent: INTENT.CAPTURE });
      return;
    }

    if (ENV.PAYMENT_INTENT == INTENT.CAPTURE) {
      toggleBooking.mutate({ bookingId, intent: INTENT.CAPTURE });
      return;
    }

    if (ENV.PAYMENT_INTENT == INTENT.AUTHORIZE) {
      toggleAuthorizedBooking.mutate({ bookingId, intent: INTENT.CAPTURE });
      return;
    }

    // error message for unsupported intent
    toast.error("Unsupported payment intent configured.");
  };

  // ── Reject (cancel) an active booking (no refund) ──
  const handleReject = (booking: BookingWithStalls) => {
    setSelectedBooking(booking);
    setRefundMode("reject");
    setRefundDialogOpen(true);
  };

  // ── Request a refund on a cancelled + paid booking ──
  const handleRequestRefund = (booking: BookingWithStalls) => {
    setSelectedBooking(booking);
    setRefundMode("request");
    setRefundDialogOpen(true);
  };

  // ── Approve a pending refund request ──
  const handleApproveRefund = (booking: BookingWithStalls) => {
    setSelectedBooking(booking);
    setRefundMode("approve");
    setRefundDialogOpen(true);
  };

  // ── Reject a pending refund request ──
  const handleRejectRefund = (booking: BookingWithStalls) => {
    setSelectedBooking(booking);
    setRefundMode("reject_refund");
    setRefundDialogOpen(true);
  };

  // ── Confirm handler dispatches to the correct mutation ──
  const handleDialogConfirm = (reason: string) => {
    if (!selectedBooking) return;
    const bookingId = selectedBooking.id;
    const onSuccess = () => { setRefundDialogOpen(false); setSelectedBooking(null); };

    if (refundMode === "reject") {
      cancelBooking.mutate({ bookingId, reason }, { onSuccess });
    } else if (refundMode === "request") {
      requestRefund.mutate({ bookingId, reason }, { onSuccess });
    } else if (refundMode === "approve") {
      approveRefund.mutate({ bookingId, reason }, { onSuccess });
    } else if (refundMode === "reject_refund") {
      rejectRefund.mutate({ bookingId, reason }, { onSuccess });
    }
  };

  const canShowActions = useCallback((booking: BookingWithStalls) => {
    const { status, payment_status } = booking;
    if(payment_status !== "success") {
      return false;
    }
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


  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Bookings</h1>
          <p className="text-gray-600 mt-1">
            Manage and review all vendor bookings
          </p>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-2">📋</span>
              Booking Management
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Export Data</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Booking Data</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-gray-600">
                    Select the format and date range for your export.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline">CSV Format</Button>
                    <Button variant="outline">PDF Format</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by invoice or market name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="refund_requested">
                    Refund Requested{pendingRefundCount > 0 ? ` (${pendingRefundCount})` : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Stalls</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>VAT</TableHead>
                  <TableHead>Booking Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Refund Status</TableHead>
                  <PermissionGate permissions={[PERMISSIONS.BOOKINGS.MANAGE]}>
                    <TableHead>Actions</TableHead>
                  </PermissionGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-8 text-gray-500"
                    >
                      No bookings found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => (
                    <TableRow key={booking.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {booking.invoice_number}
                      </TableCell>
                      <TableCell>{booking.markets?.name}</TableCell>
                      <TableCell>
                        {new Date(booking.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {booking.booking_stalls?.length || 0}
                      </TableCell>
                      <TableCell>
                        <CurrencyWrapper amount={booking.total_amount} />
                      </TableCell>
                      <TableCell>
                        {booking.vat_amount != null ? (
                          <CurrencyWrapper amount={booking.vat_amount} />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(booking.payment_status)}
                      </TableCell>
                      <TableCell>
                        {getRefundStatusBadge(booking.refund_status)}
                      </TableCell>
                      <PermissionGate
                        permissions={[PERMISSIONS.BOOKINGS.MANAGE]}
                      >
                        <TableCell >
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center gap-1">
                              {/* Approve / Reject for active bookings with payment */}
                              {canShowActions(booking) && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleApprove(booking)}
                                        disabled={
                                          toggleAuthorizedBooking.isPending ||
                                          toggleBooking.isPending
                                        }
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Approve</TooltipContent>
                                  </Tooltip>
                                  {canManageBookings && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleReject(booking)}
                                          disabled={cancelBooking.isPending}
                                        >
                                          {cancelBooking.isPending ? (
                                            <Loader className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <X className="w-4 h-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reject</TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}

                              {/* Reject for non-cancelled bookings without the approve flow */}
                              {!canShowActions(booking) && booking.status !== "cancelled" && booking.status !== "expired" && canManageBookings && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleReject(booking)}
                                      disabled={cancelBooking.isPending}
                                    >
                                      {cancelBooking.isPending ? (
                                        <Loader className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <RotateCcw  />
                                       
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Cancel</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Refund button: cancelled + paid + no refund yet */}
                              {booking.status === "cancelled" &&
                                booking.payment_status === "success" &&
                                !booking.refund_status &&
                                (canRequestRefund || canApproveRefund) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                                      onClick={() => handleRequestRefund(booking)}
                                      disabled={requestRefund.isPending}
                                    >
                                      {requestRefund.isPending ? (
                                        <Loader className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <HandCoins className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Request Refund</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Approve / Reject for pending refund requests */}
                              {booking.refund_status === "requested" && canApproveRefund && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleApproveRefund(booking)}
                                        disabled={approveRefund.isPending}
                                      >
                                        {approveRefund.isPending ? (
                                          <Loader className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <ShieldCheck className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Approve Refund</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleRejectRefund(booking)}
                                        disabled={rejectRefund.isPending}
                                      >
                                        {rejectRefund.isPending ? (
                                          <Loader className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <ShieldX className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Reject Refund</TooltipContent>
                                  </Tooltip>
                                </>
                              )}

                             

                              {/* View */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                                    <Link to={`/admin/bookings/${booking.id}`}>
                                      <Eye className="w-4 h-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Details</TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </PermissionGate>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RefundApprovalDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        booking={selectedBooking}
        mode={refundMode}
        isPending={cancelBooking.isPending || requestRefund.isPending || approveRefund.isPending || rejectRefund.isPending}
        onConfirm={handleDialogConfirm}
      />
    </div>
  );
};

export default AdminBookings;
