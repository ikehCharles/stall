import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VendorLookup } from "./VendorLookup";
import { BookingCalendar } from "@/components/vendor/BookingCalendar";
import {
  Profile,
  UnpaidInvoice,
  useUnpaidInvoice,
  VendorLookupResult,
} from "@/hooks/useVendorLookup";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertCircle, Calendar, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Market } from "@/hooks/useMarkets";
import { StallInstance } from "@/hooks/useStallInstances";
import { BookingDate } from "@/hooks/useBookingDates";
import { getKycBadge } from "@/components/shared/statuses";

interface FCABookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stall: StallInstance;
  market: Market;
  vendor: Profile;
}

export const FCABookingModal = ({
  open,
  onOpenChange,
  stall,
  market,
  vendor,
}: FCABookingModalProps) => {
  const navigate = useNavigate();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const handleContinueToCheckout = () => {
    if (selectedDates.length === 0) {
      toast({
        title: "No Dates Selected",
        description: "Please select at least one date",
        variant: "destructive",
      });
      return;
    }

    const pricePerDay =
      stall.price_override || stall.stall_templates?.price || 0;
    const totalCost = pricePerDay * selectedDates.length;

    // Store booking data in session storage
    sessionStorage.setItem(
      "fcaBooking",
      JSON.stringify({
        marketId: market.id,
        vendorId: vendor?.user_id,
        vendorDetails: vendor,
        stallSelection: {
          stall,
          selectedDates,
          totalCost,
        },
      })
    );

    navigate("/admin/fca/checkout");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            FCA Booking - {stall?.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stall Details */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stall:</span>
                  <span className="font-medium">{stall?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium">
                    {stall?.stall_templates?.name || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per Day:</span>
                  <span className="font-medium">
                    $
                    {(
                      stall?.price_override ||
                      stall?.stall_templates?.price ||
                      0
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Scenario B: Date Selection */}
          <div className="space-y-4">
            {vendor && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendor:</span>
                      <span className="font-medium">{vendor.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">KYC Status:</span>
                      {getKycBadge(vendor.kyc_status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <BookingCalendar
              marketId={market.id}
              stallInstanceId={stall.id}
              marketStartDate={market.start_at}
              marketEndDate={market.end_at}
              selectedDates={selectedDates}
              onDateSelect={setSelectedDates}
              maxDays={5}
            />

            {selectedDates.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Days Selected:
                      </span>
                      <span className="font-medium">
                        {selectedDates.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-lg">
                        $
                        {(
                          (stall?.price_override ||
                            stall?.stall_templates?.price ||
                            0) * selectedDates.length
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleContinueToCheckout}
              disabled={selectedDates.length === 0}
            >
              Continue to Checkout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
