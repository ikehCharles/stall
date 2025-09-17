import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAdminBookings, useAdminApproveBooking, useAdminDeclineBooking } from "@/hooks/useAdminBookings";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X } from "lucide-react";

const AdminBookings = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { data: bookings, isLoading } = useAdminBookings();
  const approveBooking = useAdminApproveBooking();
  const declineBooking = useAdminDeclineBooking();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'awaiting_admin':
        return <Badge className="bg-yellow-100 text-yellow-800">Awaiting Admin</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default">Paid</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredBookings = bookings?.filter(booking => {
    const matchesSearch = booking.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.markets?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleApprove = (bookingId: string) => {
    approveBooking.mutate(bookingId);
  };

  const handleDecline = (bookingId: string) => {
    declineBooking.mutate(bookingId);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">All Bookings</h1>
        <p className="text-gray-600 mt-1">Manage and review all vendor bookings</p>
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
                  <SelectItem value="awaiting_admin">Awaiting Admin</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No bookings found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => (
                    <TableRow key={booking.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{booking.invoice_number}</TableCell>
                      <TableCell>{booking.markets?.name}</TableCell>
                      <TableCell>{new Date(booking.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{booking.booking_stalls?.length || 0}</TableCell>
                      <TableCell>${booking.total_amount}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(booking.payment_status)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {booking.status === 'awaiting_admin' && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleApprove(booking.id)}
                                disabled={approveBooking.isPending}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDecline(booking.id)}
                                disabled={declineBooking.isPending}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Decline
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </div>
                      </TableCell>
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
