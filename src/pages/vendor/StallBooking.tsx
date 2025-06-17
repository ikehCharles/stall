
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { mockStalls, mockEvents, Stall } from "../../data/mockData";

const StallBooking = () => {
  const [selectedStalls, setSelectedStalls] = useState<Stall[]>([]);
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const currentEvent = mockEvents[1]; // Winter Holiday Market
  const availableStalls = mockStalls.filter(stall => !stall.isBooked);

  const handleStallClick = (stall: Stall) => {
    if (stall.isBooked) {
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

  const totalCost = selectedStalls.reduce((sum, stall) => sum + stall.price, 0);

  const handleCheckout = () => {
    toast({
      title: "Booking Confirmed!",
      description: `Successfully booked ${selectedStalls.length} stall(s) for $${totalCost}`
    });
    setSelectedStalls([]);
    setIsCheckoutOpen(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Book Stalls</h1>
        <p className="text-gray-600 mt-1">Select your stalls for {currentEvent.name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stall Layout */}
        <div className="lg:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">🗺️</span>
                Stall Layout - {currentEvent.name}
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
                <svg width="100%" height="350" viewBox="0 0 500 300">
                  {mockStalls.map((stall) => {
                    const isSelected = selectedStalls.find(s => s.id === stall.id);
                    let fillColor = stall.isBooked ? '#ef4444' : '#22c55e'; // red : green
                    if (isSelected) fillColor = '#3b82f6'; // blue

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
                          ${stall.price}
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
                          <div className="text-sm text-gray-600">${stall.price}</div>
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
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    onClick={() => setIsCheckoutOpen(true)}
                  >
                    Proceed to Checkout
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
              {selectedStall?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedStall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Price</h4>
                  <p className="text-2xl font-bold text-green-600">${selectedStall.price}</p>
                </div>
                <div>
                  <h4 className="font-medium">Status</h4>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Available
                  </Badge>
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
              Review your booking for {currentEvent.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {selectedStalls.map((stall) => (
                <div key={stall.id} className="flex justify-between">
                  <span>Stall {stall.label}</span>
                  <span>${stall.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>${totalCost}</span>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleCheckout} className="flex-1">
                Proceed to Pay
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
