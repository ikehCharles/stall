
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useMarkets } from "@/hooks/useMarkets";
import { useStallInstances } from "@/hooks/useStallInstances";
import { useCreateBooking, CreateBookingData } from "@/hooks/useBookings";
import type { Database } from "@/integrations/supabase/types";

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

const StallBooking = () => {
  const { marketId } = useParams<{ marketId: string }>();
  const [selectedStalls, setSelectedStalls] = useState<StallInstance[]>([]);
  const [selectedStall, setSelectedStall] = useState<StallInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [bookedStallIds, setBookedStallIds] = useState<Set<string>>(new Set());

  const { data: markets } = useMarkets();
  const { data: stallInstances, isLoading: stallsLoading } = useStallInstances(marketId || '');
  const createBooking = useCreateBooking();

  const currentMarket = markets?.find(m => m.id === marketId);
  
  // Create enhanced stall instances with booking status
  const stalls: StallInstance[] = stallInstances?.map(stall => ({
    ...stall,
    isBooked: bookedStallIds.has(stall.id)
  })) || [];

  // Simulate fetching booked stalls (in real app, this would come from bookings data)
  useEffect(() => {
    // This is a simplified version - in reality you'd query existing bookings
    // For now, we'll use the stall status from the database
    const bookedIds = new Set(
      stallInstances?.filter(stall => stall.status === 'BOOKED').map(stall => stall.id) || []
    );
    setBookedStallIds(bookedIds);
  }, [stallInstances]);

  const handleStallClick = (stall: StallInstance) => {
    if (stall.isBooked || stall.status === 'BOOKED') {
      toast({
        title: "Stall Unavailable",
        description: "This stall is already booked",
        variant: "destructive"
      });
      return;
    }
    setSelectedStall(stall);
    setIsModalOpen(true);
  };

  const handleSelectStall = () => {
    if (selectedStall && !selectedStalls.find(s => s.id === selectedStall.id)) {
      setSelectedStalls([...selectedStalls, selectedStall]);
      toast({
        title: "Stall Selected",
        description: `Stall ${selectedStall.label} added to your selection`
      });
    }
    setIsModalOpen(false);
  };

  const handleRemoveStall = (stallId: string) => {
    setSelectedStalls(selectedStalls.filter(s => s.id !== stallId));
  };

  const totalCost = selectedStalls.reduce((sum, stall) => sum + (stall.price_override || stall.stall_templates?.price || 0), 0);

  const handleCheckout = async () => {
    if (!marketId || selectedStalls.length === 0) return;
    
    try {
      const bookingData: CreateBookingData = {
        marketId,
        stallIds: selectedStalls.map(stall => stall.id),
        totalAmount: totalCost
      };

      await createBooking.mutateAsync(bookingData);
      
      toast({
        title: "Booking Confirmed!",
        description: `Successfully booked ${selectedStalls.length} stall(s) for $${totalCost}`
      });
      
      setSelectedStalls([]);
      setIsCheckoutOpen(false);
    } catch (error) {
      toast({
        title: "Booking Failed",
        description: "There was an error processing your booking. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (stallsLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-96 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-2/3"></div>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-gray-200 rounded"></div>
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
          <p className="text-muted-foreground mt-1">The selected market could not be found.</p>
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
        <p className="text-muted-foreground mt-1">Select your stalls for {currentMarket.name}</p>
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
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                  Selected
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative bg-gray-100 rounded-lg p-8 min-h-[400px]">
                <svg width="100%" height="350" viewBox="0 0 800 600">
                  {stalls.map((stall) => {
                    const isSelected = selectedStalls.find(s => s.id === stall.id);
                    let fillColor = stall.isBooked || stall.status === 'BOOKED' ? '#ef4444' : '#22c55e'; // red : green
                    if (isSelected) fillColor = '#3b82f6'; // blue

                    const stallPrice = stall.price_override || stall.stall_templates?.price || 0;

                    return (
                      <g key={stall.id}>
                        <rect
                          x={stall.x}
                          y={stall.y}
                          width={stall.width}
                          height={stall.height}
                          fill={fillColor}
                          stroke="#ffffff"
                          strokeWidth="2"
                          rx="4"
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleStallClick(stall)}
                        />
                        <text
                          x={stall.x + stall.width / 2}
                          y={stall.y + stall.height / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize="14"
                          fontWeight="bold"
                        >
                          {stall.label}
                        </text>
                        <text
                          x={stall.x + stall.width / 2}
                          y={stall.y + stall.height / 2 + 15}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize="10"
                        >
                          ${stallPrice}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
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
                <p className="text-gray-500 text-center py-8">No stalls selected</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {selectedStalls.map((stall) => (
                      <div key={stall.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <div className="font-medium">Stall {stall.label}</div>
                          <div className="text-sm text-gray-600">${stall.price_override || stall.stall_templates?.price || 0}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStall(stall.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>${totalCost}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full"
                    onClick={() => setIsCheckoutOpen(true)}
                    disabled={createBooking.isPending}
                  >
                    {createBooking.isPending ? 'Processing...' : 'Proceed to Checkout'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stall Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stall {selectedStall?.label}</DialogTitle>
            <DialogDescription>
              Stall information and booking details
            </DialogDescription>
          </DialogHeader>
          {selectedStall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Price</h4>
                  <p className="text-2xl font-bold text-green-600">${selectedStall.price_override || selectedStall.stall_templates?.price || 0}</p>
                </div>
                <div>
                  <h4 className="font-medium">Status</h4>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Available
                  </Badge>
                </div>
                <div className="col-span-2">
                  <h4 className="font-medium">Template</h4>
                  <p className="text-sm text-muted-foreground">{selectedStall.stall_templates?.name}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleSelectStall} className="flex-1">
                  Select Stall
                </Button>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            <div className="space-y-2">
              {selectedStalls.map((stall) => (
                <div key={stall.id} className="flex justify-between">
                  <span>Stall {stall.label}</span>
                  <span>${stall.price_override || stall.stall_templates?.price || 0}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>${totalCost}</span>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={handleCheckout} 
                className="flex-1"
                disabled={createBooking.isPending}
              >
                {createBooking.isPending ? 'Processing...' : 'Proceed to Pay'}
              </Button>
              <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StallBooking;

// Enhanced version with date-based booking - uncomment to replace
// export { default } from './EnhancedStallBooking';
