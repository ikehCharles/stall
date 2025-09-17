import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { BookingCalendar } from "./BookingCalendar";
import { StallHoldTimer } from "./StallHoldTimer";
import { useCreateStallHold } from "@/hooks/useStallHolds";
import { format } from "date-fns";

type StallInstance = Database['public']['Tables']['stall_instances']['Row'] & {
  stall_templates?: {
    name: string;
    shape: Database['public']['Enums']['stall_shape'];
    fill_color: string;
    stroke_color: string;
    price: number;
    capacity: number;
  };
  isBooked?: boolean;
};

interface Market {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
}

interface EnhancedStallModalProps {
  stall: StallInstance | null;
  market: Market | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectStall: (stall: StallInstance, selectedDates: Date[]) => void;
}

export function EnhancedStallModal({
  stall,
  market,
  isOpen,
  onClose,
  onSelectStall
}: EnhancedStallModalProps) {
  const { user } = useAuth();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [holdExpiry, setHoldExpiry] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdResponse, setHoldResponse] = useState<{
    days: number;
    price_per_day: number;
    total: number;
  } | null>(null);
  
  const createHold = useCreateStallHold();

  useEffect(() => {
    if (!isOpen) {
      setSelectedDates([]);
      setHoldExpiry(null);
      setIsHolding(false);
      setHoldResponse(null);
    }
  }, [isOpen]);

  const handleDateSelect = async (dates: Date[]) => {
    setSelectedDates(dates);
    
    if (dates.length > 0 && stall && market) {
      // Check authentication before proceeding
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to reserve a stall.",
          variant: "destructive"
        });
        return;
      }

      try {
        setIsHolding(true);
        const dateStrings = dates.map(d => d.toISOString().split('T')[0]);
        
        const response = await createHold.mutateAsync({
          stallId: stall.id,
          marketId: market.id,
          dates: dateStrings
        });
        
        // Store the pricing information from the response
        if (response.days && response.price_per_day && response.total) {
          setHoldResponse({
            days: response.days,
            price_per_day: response.price_per_day,
            total: response.total
          });
        }
        
        // Set hold expiry to 5 minutes from now
        const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        setHoldExpiry(expiry);
        
        toast({
          title: "Stall Reserved",
          description: `Stall ${stall.label} is held for 5 minutes. Total: $${response.total?.toFixed(2) || '0.00'}`
        });
      } catch (error: any) {
        console.error('Hold creation error:', error);
        
        // Provide specific error messages based on the error
        let errorMessage = "Could not reserve this stall for the selected dates.";
        
        if (error?.message?.includes("Authentication required")) {
          errorMessage = "Please log in to reserve a stall.";
        } else if (error?.message?.includes("not available") || error?.message?.includes("conflict") || error?.message?.includes("already booked")) {
          errorMessage = "Selected dates are not available for this stall. Please choose different dates.";
        } else if (error?.message?.includes("not found")) {
          errorMessage = "This stall is no longer available.";
        } else if (error?.message?.includes("network") || error?.message?.includes("connection")) {
          errorMessage = "Network error. Please check your connection and try again.";
        }
        
        toast({
          title: "Reservation Failed",
          description: errorMessage,
          variant: "destructive"
        });
        setSelectedDates([]);
      } finally {
        setIsHolding(false);
      }
    }
  };

  const handleConfirmSelection = () => {
    if (stall && selectedDates.length > 0) {
      onSelectStall(stall, selectedDates);
      onClose();
    }
  };

  const handleHoldExpired = () => {
    setHoldExpiry(null);
    setSelectedDates([]);
    setHoldResponse(null);
    toast({
      title: "Hold Expired",
      description: "Your stall reservation has expired. Please select dates again.",
      variant: "destructive"
    });
  };

  if (!stall || !market) return null;

  // Use pricing from hold response if available, otherwise calculate from stall data
  const pricePerDay = holdResponse?.price_per_day || stall.price_override || stall.stall_templates?.price || 0;
  const totalPrice = holdResponse?.total || (pricePerDay * selectedDates.length);
  const daysCount = holdResponse?.days || selectedDates.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Stall {stall.label}</span>
            {holdExpiry && (
              <StallHoldTimer 
                expiresAt={holdExpiry} 
                onExpired={handleHoldExpired}
              />
            )}
          </DialogTitle>
          <DialogDescription>
            Select your booking dates for {market.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stall Information */}
          <Card>
            <CardHeader>
              <CardTitle>Stall Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Price per Day</h4>
                  <p className="text-2xl font-bold text-primary">${pricePerDay}</p>
                </div>
                <div>
                  <h4 className="font-medium">Status</h4>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Available
                  </Badge>
                </div>
                <div className="col-span-2">
                  <h4 className="font-medium">Template</h4>
                  <p className="text-sm text-muted-foreground">{stall.stall_templates?.name}</p>
                </div>
                {selectedDates.length > 0 && (
                  <div className="col-span-2">
                    <h4 className="font-medium">Selected Dates</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedDates.map(date => (
                        <Badge key={date.toISOString()} variant="outline">
                          {format(date, 'MMM d')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDates.length > 0 && (
                  <div className="col-span-2 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Cost:</span>
                      <span className="text-xl font-bold text-primary">${totalPrice.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {daysCount} day{daysCount > 1 ? 's' : ''} × ${pricePerDay.toFixed(2)}/day
                    </p>
                    {holdResponse && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Pricing confirmed from server
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Calendar */}
          <BookingCalendar
            marketId={market.id}
            stallInstanceId={stall.id}
            marketStartDate={market.start_at}
            marketEndDate={market.end_at}
            selectedDates={selectedDates}
            onDateSelect={handleDateSelect}
            disabled={isHolding}
          />
        </div>

        <div className="flex space-x-2 pt-4">
          <Button 
            onClick={handleConfirmSelection} 
            className="flex-1"
            disabled={selectedDates.length === 0 || isHolding}
          >
            {isHolding ? 'Reserving...' : `Add to Selection (${selectedDates.length} days)`}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}