import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react";
import { FCACollectSheet } from "@/components/admin/fca/FCACollectSheet";
import {
  useCreateBooking,
  CreateBookingData,
  useFetchBookingDetails,
} from "@/hooks/useBookings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SessionVendorStorage } from "@/components/admin/fca/FCABookingModal";
import {
  getKycBadge,
  getPaymentStatusBadge,
} from "@/components/shared/statuses";
import { useReconcileOfflineBooking } from "@/hooks/useOfflineBooking";

const FCACheckout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const bookingRes = useFetchBookingDetails();
  const [showCollectSheet, setShowCollectSheet] = useState(false);
  const [bookingData, setBookingData] = useState<SessionVendorStorage>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const createBooking = useCreateBooking();
  const reconcileOffline = useReconcileOfflineBooking();

  useEffect(() => {
    const stored = sessionStorage.getItem("fcaBooking");
    if (!stored) {
      toast({
        title: "No Booking Data",
        description: "Please select a stall and vendor first",
        variant: "destructive",
      });
      navigate("/admin/fca/markets");
      return;
    }

    try {
      const data: SessionVendorStorage = JSON.parse(stored);
      if (!data.vendorId || !data.vendorDetails) {
        throw new Error("Vendor information missing");
      }
      setBookingData(data);
    } catch (error) {
      toast({
        title: "Invalid Booking Data",
        description: "Please start over",
        variant: "destructive",
      });
      navigate("/admin/fca/markets");
    }
  }, [navigate]);

  // Create booking when data is loaded
  useEffect(() => {
    if (!bookingData || bookingId || isCreatingBooking || !user) return;

    const createFCABooking = async () => {
      setIsCreatingBooking(true);

      const { marketId, vendorId, stallSelection } = bookingData;
      const pricePerDay =
        stallSelection.stall.price_override ||
        stallSelection.stall.stall_templates?.price ||
        0;

      const bookingPayload: CreateBookingData = {
        marketId,
        stallIds: [stallSelection.stall.id],
        totalAmount: stallSelection.totalCost,
        selectedDates: stallSelection.selectedDates.map((date: Date) =>
          format(new Date(date), "yyyy-MM-dd")
        ),
        pricePerDay,
        vendorId: vendorId,
        createdByFcaId: user.id,
        fcaNotes: "FCA on-site booking - awaiting payment",
      };

      try {
        const result = await createBooking.mutateAsync(bookingPayload);
        setBookingId(result.id);
        toast({
          title: "Booking Created",
          description: "Ready to collect payment",
        });
        bookingRes.mutateAsync(result.id);
      } catch (error) {
        toast({
          title: "Failed to complete booking",
          description: "Please try again",
          variant: "destructive",
        });
        navigate("/admin/fca/markets");
      } finally {
        setIsCreatingBooking(false);
      }
    };

    createFCABooking();
  }, [
    bookingData,
    bookingId,
    isCreatingBooking,
    user,
    createBooking,
    navigate,
    bookingRes,
  ]);

  const handleRefresh = async () => {
    await reconcileOffline.mutateAsync();
    const booking = await bookingRes.mutateAsync(bookingRes.data.id);
    if (booking.payment_status === "success") {
      handlePaymentSuccess(booking.id);
    }
  };

  const handlePaymentSuccess = async (bookingId: string) => {
    if (!bookingData || !bookingId) return;

    try {
      // Update FCA notes to include payment method
      await supabase
        .from("bookings")
        .update({
          fca_notes: `FCA on-site POS payment - collected and confirmed`,
        })
        .eq("id", bookingId);

      sessionStorage.removeItem("fcaBooking");

      toast({
        title: "Payment Confirmed",
        description: `POS payment of $${bookingData.stallSelection.totalCost.toFixed(
          2
        )} processed successfully`,
      });

      navigate(`/admin/fca/invoices/${bookingId}`);
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    }
  };

  if (!bookingData || isCreatingBooking || !bookingId) {
    return (
      <div className="p-6">
        <div className="text-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {!bookingData ? "Loading booking data..." : "Creating booking..."}
          </p>
        </div>
      </div>
    );
  }

  const { stallSelection, vendorDetails } = bookingData;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/fca/markets")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Markets
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            Payment Summary
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">
            <Briefcase className="h-4 w-4 mr-2" />
            FCA Mode
          </Badge>
          <Button
            variant="outline"
            onClick={() => navigate("/admin")}
            size="sm"
          >
            Exit FCA Mode
          </Button>
        </div>
      </div>

      {vendorDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Vendor Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">
                {vendorDetails.full_name || "N/A"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{vendorDetails.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">KYC Status:</span>
              {getKycBadge(vendorDetails.kyc_status)}
            </div>
            {vendorDetails.company_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company:</span>
                <span className="font-medium">
                  {vendorDetails.company_name}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex flex-wrap justify-between gap-2">
              <h2>Booking Details</h2>
              <div className="flex flex-col justify-end items-end text-sm">
                <h4>Payment Status</h4>
                <div>{getPaymentStatusBadge(bookingRes?.data?.payment_status)}</div>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {!!bookingRes?.data?.invoice_number && <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice:</span>
              <span className="font-medium">{bookingRes?.data?.invoice_number}</span>
            </div>}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stall:</span>
              <span className="font-medium">{stallSelection.stall.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Template:</span>
              <span className="font-medium">
                {stallSelection.stall.stall_templates?.name || "N/A"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Days:</span>
              <span className="font-medium">
                {stallSelection.selectedDates.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price per Day:</span>
              <span className="font-medium">
                $
                {(
                  stallSelection.stall.price_override ||
                  stallSelection.stall.stall_templates?.price ||
                  0
                ).toFixed(2)}
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <h4 className="text-sm font-medium">Selected Dates:</h4>
            <div className="flex flex-wrap gap-2">
              {stallSelection.selectedDates.map((date: Date, idx: number) => (
                <Badge key={idx} variant="secondary">
                  {format(new Date(date), "MMM d, yyyy")}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subtotal:</span>
              <span className="font-medium">
                ${stallSelection.totalCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tax (0%):</span>
              <span className="font-medium">$0.00</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total Amount:</span>
              <span>${stallSelection.totalCost.toFixed(2)}</span>
            </div>
          </div>
          <div>
            {!bookingRes.data?.offline_invoice_id && bookingRes.data.payment_status !== 'success' && (
              <Button
                className="w-full mt-4"
                size="lg"
                onClick={() => setShowCollectSheet(true)}
                disabled={!bookingId}
              >
                Collect Payment
              </Button>
            )}
            {bookingRes.data?.offline_invoice_id && (
              <Button
                className="w-full mt-4"
                size="lg"
                onClick={handleRefresh}
                disabled={!bookingId || reconcileOffline.isPending}
              >
                {reconcileOffline.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <FCACollectSheet
        open={showCollectSheet}
        onOpenChange={() => {
          setShowCollectSheet(false);
          bookingRes.mutateAsync(bookingRes?.data?.id);
        }}
        amount={stallSelection.totalCost}
        bookingRes={bookingRes}
      />
    </div>
  );
};

export default FCACheckout;
