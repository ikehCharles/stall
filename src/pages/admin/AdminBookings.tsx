import React, { useCallback, useState } from "react";
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
} from "@/hooks/useAdminBookings";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { ENV } from "@/lib/utils";
import { INTENT } from "@/lib/enums";
import { toast } from "sonner";
import { BookingWithStalls } from "@/hooks/useBookings";
import { useConfirm } from "@/components/ui/confirmDialog";

const AdminBookings = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const confirm = useConfirm();
  const { data: bookings, isLoading } = useAdminBookings();
  const toggleAuthorizedBooking = useAdminToggleAuthorizedBooking();
  const toggleBooking = useAdminToggleBooking();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Pending
          </Badge>
        );
      case "reserved":
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            Reserved
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Approved
          </Badge>
        );
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "expired":
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "authorized":
        return <Badge variant="default">Authorized</Badge>;
      case "success":
        return <Badge variant="default">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Captured</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "refunded":
        return <Badge variant="destructive">Refunded</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const filteredBookings =
    bookings?.filter((booking) => {
      const matchesSearch =
        booking.invoice_number
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        booking.markets?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;
      return matchesSearch && matchesStatus;
    }) || [];

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
      toggleBooking.mutate({ bookingId, intent: INTENT.VOID });
      return;
    }

    if (ENV.PAYMENT_INTENT == INTENT.AUTHORIZE) {
      const val = await confirm({
        ...declineInfo,
        description:
          "This will void authorized payment and decline booking. Are you sure you want to proceed?",
      });
      if (!val) return;
      toggleAuthorizedBooking.mutate({ bookingId, intent: INTENT.VOID });
      return;
    }
    if (ENV.PAYMENT_INTENT == INTENT.CAPTURE) {
      const val = await confirm({
        ...declineInfo,
        description:
          "This will refund payment and decline booking. Are you sure you want to proceed?",
      });
      if (!val) return;
      toggleBooking.mutate({ bookingId, intent: INTENT.REFUND });
      return;
    }

    // error message for unsupported intent
    toast.error("Unsupported payment intent configured.");
  };

  const canShowActions = useCallback((booking: BookingWithStalls) => {
    if (booking.status === "reserved" || booking.payment_status === "pending") {
      return true;
    }
    return (
      ["success", "authorized"].includes(booking.payment_status) &&
      ["pending", "reserved"].includes(booking.status)
    );
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">All Bookings</h1>
        <p className="text-gray-600 mt-1">
          Manage and review all vendor bookings
        </p>
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
                  <TableHead>Booking Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <PermissionGate permissions={[PERMISSIONS.BOOKINGS.MANAGE]}>
                    <TableHead>Actions</TableHead>
                  </PermissionGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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
                      <TableCell>${booking.total_amount}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(booking.payment_status)}
                      </TableCell>
                      <PermissionGate
                        permissions={[PERMISSIONS.BOOKINGS.MANAGE]}
                      >
                        <TableCell>
                          <div className="flex space-x-2">
                            {canShowActions(booking) && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApprove(booking)}
                                  disabled={
                                    toggleAuthorizedBooking.isPending ||
                                    toggleBooking.isPending
                                  }
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDecline(booking)}
                                  disabled={
                                    toggleAuthorizedBooking.isPending ||
                                    toggleBooking.isPending
                                  }
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Decline
                                </Button>
                              </>
                            )}
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/admin/bookings/${booking.id}`}>
                                View
                              </Link>
                            </Button>
                          </div>
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
    </div>
  );
};

export default AdminBookings;
