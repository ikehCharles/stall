import { useState, useEffect } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useMarkets } from "@/hooks/useMarkets";
import { StallInstance, useStallInstances } from "@/hooks/useStallInstances";
import {
  useCreateBooking,
  CreateBookingData,
  useReserveBooking,
  useVendorSuccessBookingCount,
} from "@/hooks/useBookings";
import { useStallHolds, useCleanupExpiredHolds } from "@/hooks/useStallHolds";
import { usePlatformSettings } from "@/hooks/useSettings";
import { useBookingDates } from "@/hooks/useBookingDates";
import { EnhancedStallModal } from "@/components/vendor/EnhancedStallModal";
import { StallHoldTimer } from "@/components/vendor/StallHoldTimer";
import { StallCanvasView } from "@/components/shared/StallCanvasView";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import CurrencyWrapper from "@/components/shared/currency";
import VatBreakdown from "@/components/shared/VatBreakdown";
import { formatCurrency } from "@/lib/utils";


interface StallSelection {
  stall: StallInstance;
  selectedDates: Date[];
  totalCost: number;
}

const EnhancedStallBooking = () => {
  const { marketId } = useParams<{ marketId: string }>();
  const { user: currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedStalls, setSelectedStalls] = useState<StallSelection[]>([]);
  const [selectedStall, setSelectedStall] = useState<StallInstance | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const reserveBooking = useReserveBooking();
  const { data: markets } = useMarkets();
  const { data: stallInstances, isLoading: stallsLoading } = useStallInstances(
    marketId || ""
  );
  const { data: currentStallHolds = {} } = useStallHolds(marketId || "");
  const { data: bookedDates = [] } = useBookingDates(marketId || "");
  const createBooking = useCreateBooking();
  const cleanupHolds = useCleanupExpiredHolds();
  const { data: platformSettings, error: settingsError } = usePlatformSettings();
  const { data: completedBookingCount = 0 } = useVendorSuccessBookingCount();

  const currentMarket = markets?.find((m) => m.id === marketId);

  // Minimum completed (paid) bookings required before Pay Later is available
  const minBookings =
    settingsError || !platformSettings || !platformSettings.minBookings
      ? Infinity
      : platformSettings.minBookings;
  // When the minimum-bookings rule is not active, everyone gets Pay Later
  const hasPayLaterEligibility =
    platformSettings?.minBookingsActive === false
      ? true
      : completedBookingCount >= minBookings;


  // Create enhanced stall instances with booking and hold status
  const stalls: StallInstance[] =
    stallInstances?.map((stall, _, arr) => {
      const stallBookedDates = bookedDates
        .filter((bd) => bd.stall_instance_id === stall.id)
        .map((bd) => bd.booking_date);

      // Check if this stall has any active holds
      const stallHeldDates = currentStallHolds[stall.id] || [];

      return {
        ...stall,
        isSelected: stallBookedDates.length > 0,
        isHeld: stallHeldDates.length > 0,
      };
    }) || [];

  const handleStallClick = (stall: StallInstance) => {
    if (stall.status !== "AVAILABLE") {
      toast({
        title: "Stall Unavailable",
        description: "This stall is not available for booking",
        variant: "destructive",
      });
      return;
    }
    setSelectedStall(stall);
    setIsModalOpen(true);
  };

  const handleSelectStall = (stall: StallInstance, selectedDates: Date[]) => {
    const pricePerDay =
      stall.price_override || stall.stall_templates?.price || 0;
    const totalCost = pricePerDay * selectedDates.length;

    const newSelection: StallSelection = {
      stall,
      selectedDates,
      totalCost,
    };

    setSelectedStalls((prev) => {
      // Remove any existing selection for this stall
      const filtered = prev.filter((s) => s.stall.id !== stall.id);
      return [...filtered, newSelection];
    });

    toast({
      title: "Stall Selected",
      description: `Stall ${stall.label} selected for ${
        selectedDates.length
      } day${selectedDates.length > 1 ? "s" : ""}`,
    });
  };

  const handleRemoveStall = (stallId: string) => {
    setSelectedStalls((prev) => prev.filter((s) => s.stall.id !== stallId));
  };

  const getTotalCost = () => {
    return selectedStalls.reduce(
      (sum, selection) => sum + selection.totalCost,
      0
    );
  };

  const getTotalDays = () => {
    return selectedStalls.reduce(
      (sum, selection) => sum + selection.selectedDates.length,
      0
    );
  };

  const handleCheckout = async (payLater?: boolean) => {
    if (!marketId || selectedStalls.length === 0) return;

    try {
      // Prepare booking data with all selected dates
      const allDates = Array.from(
        new Set(
          selectedStalls.flatMap((selection) =>
            selection.selectedDates.map(
              (date) => date.toISOString().split("T")[0]
            )
          )
        )
      );
      const bookingData: CreateBookingData = {
        marketId,
        stallIds: selectedStalls.map((selection) => selection.stall.id),
        totalAmount: getTotalCost(),
        selectedDates: allDates,
        pricePerDay:
          selectedStalls[0]?.stall.price_override ||
          selectedStalls[0]?.stall.stall_templates?.price ||
          0,
          payLater
      };

      const booking = await createBooking.mutateAsync(bookingData);

      toast({
        title: "Booking Created!",
        description:
          "Redirecting to booking details to complete payment...Proceed to making payment",
      });

      if (payLater) {
        await reserveBooking.mutateAsync(booking.id);
      }

      // Navigate to booking details page
      navigate(`/vendor/bookings/${booking.id}`);
    } catch (error) {
      toast({
        title: error || "Booking Failed",
        description:
          "There was an error processing your booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStallColor = (stall: StallInstance) => {
    if (stall.status === "BOOKED") return "#ef4444"; // red - booked
    if (stall.isSelected) return "#3b82f6"; // blue - selected
    // if (stall.isHeld) return '#f97316'; // orange - held
    return "#22c55e"; // green - available
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!authLoading && !currentUser) {
    const currentPath = `/vendor/book-stall/${marketId}`;
    return <Navigate to={`/login?next=${currentPath}`} replace />;
  }

  if (authLoading || stallsLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-96 bg-muted rounded"></div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-muted rounded"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!currentMarket) {
    return (
      <div className="space-y-8">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/vendor/markets">← Back to Markets</Link>
          </Button>
          <h1 className="text-3xl font-bold">Market Not Found</h1>
          <p className="text-muted-foreground mt-1">
            The selected market could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="mb-4">
          <Link to="/vendor/markets">← Back to Markets</Link>
        </Button>
        <h1 className="text-3xl font-bold">Book Stalls</h1>
        <p className="text-muted-foreground mt-1">
          Select your stalls and dates for {currentMarket.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stall Layout */}
        <div className="lg:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">🗺️</span>
                Stall Layout - {currentMarket.name}
              </CardTitle>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                  Available
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                  Booked
                </div>
                {/* <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
                  Held
                </div> */}
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                  Selected
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <StallCanvasView
                stalls={stalls}
                onStallClick={handleStallClick}
                getStallColor={getStallColor}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary Panel */}
        <div>
          <Card className="shadow-lg sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">🛒</span>
                Your Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedStalls.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No stalls selected
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {selectedStalls.map((selection) => (
                      <div
                        key={selection.stall.id}
                        className="p-3 bg-primary/5 rounded-lg border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">
                            Stall {selection.stall.label}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveStall(selection.stall.id)
                            }
                            className="text-destructive hover:text-destructive/80 h-auto p-1"
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selection.selectedDates.length} day
                          {selection.selectedDates.length > 1 ? "s" : ""} × 
                          {formatCurrency(selection.stall.price_override ||
                            selection.stall.stall_templates?.price ||
                            0)}
                          /day
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selection.selectedDates.map((date) => (
                            <Badge
                              key={date.toISOString()}
                              variant="outline"
                              className="text-xs"
                            >
                              {format(date, "MMM d")}
                            </Badge>
                          ))}
                        </div>
                        <div className="font-semibold text-primary mt-2">
                          <CurrencyWrapper amount={selection.totalCost} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Stalls:</span>
                      <span>{selectedStalls.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Days:</span>
                      <span>{getTotalDays()}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total Cost:</span>
                      <CurrencyWrapper amount={getTotalCost()} />
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() =>
                      hasPayLaterEligibility
                        ? setIsCheckoutOpen(true)
                        : handleCheckout()
                    }
                    disabled={createBooking.isPending}
                  >
                    {createBooking.isPending
                      ? "Processing..."
                      : "Proceed to Checkout"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Stall Modal */}
      <EnhancedStallModal
        stall={selectedStall}
        market={currentMarket}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectStall={handleSelectStall}
      />

      {/* Checkout Modal */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Review your booking for {currentMarket.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {selectedStalls.map((selection) => (
                <div key={selection.stall.id} className="border rounded p-3">
                  <div className="font-medium">
                    Stall {selection.stall.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selection.selectedDates.length} day
                    {selection.selectedDates.length > 1 ? "s" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selection.selectedDates.map((date) => (
                      <Badge
                        key={date.toISOString()}
                        variant="outline"
                        className="text-xs"
                      >
                        {format(date, "MMM d")}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-right font-semibold">
                    <CurrencyWrapper amount={selection.totalCost} />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Total Stalls:</span>
                <span>{selectedStalls.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Days:</span>
                <span>{getTotalDays()}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>
                  <CurrencyWrapper amount={getTotalCost()} />
                </span>
              </div>
            </div>
            <div className="flex space-x-2">
              {hasPayLaterEligibility && (
                <Button
                  onClick={() => handleCheckout(true)}
                  variant="outline"
                  className="flex-1"
                  disabled={createBooking.isPending || reserveBooking.isPending}
                >
                  {reserveBooking.isPending ? "Processing..." : "Pay Later"}
                </Button>
              )}
              <Button
                onClick={() => handleCheckout()}
                className="flex-1"
                disabled={createBooking.isPending || reserveBooking.isPending}
              >
                {createBooking.isPending
                  ? "Processing..."
                  : "Proceed To Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedStallBooking;
