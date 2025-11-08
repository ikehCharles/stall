import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useMarkets } from '@/hooks/useMarkets';
import { useStallInstances } from '@/hooks/useStallInstances';
import { useStallHolds } from '@/hooks/useStallHolds';
import { useBookingDates } from '@/hooks/useBookingDates';
import { EnhancedStallModal } from '@/components/vendor/EnhancedStallModal';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import { ArrowLeft, Briefcase } from 'lucide-react';

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
  isHeld?: boolean;
};

interface StallSelection {
  stall: StallInstance;
  selectedDates: Date[];
  totalCost: number;
}

const FCAStallBooking = () => {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [selectedStall, setSelectedStall] = useState<StallInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stallSelection, setStallSelection] = useState<StallSelection | null>(null);

  const { data: markets } = useMarkets();
  const { data: stallInstances, isLoading: stallsLoading } = useStallInstances(marketId || '');
  const { data: currentStallHolds = {} } = useStallHolds(marketId || '');
  const { data: bookedDates = [] } = useBookingDates(marketId || '');

  const currentMarket = markets?.find(m => m.id === marketId);

  const stalls: StallInstance[] = stallInstances?.map(stall => {
    const stallBookedDates = bookedDates.filter(bd => 
      bd.stall_instance_id === stall.id
    ).map(bd => bd.booking_date);

    const stallHeldDates = currentStallHolds[stall.id] || [];

    return {
      ...stall,
      isBooked: stallBookedDates.length > 0,
      isHeld: stallHeldDates.length > 0
    };
  }) || [];

  const handleStallClick = (stall: StallInstance) => {
    if (stall.status !== 'AVAILABLE') {
      toast({
        title: 'Stall Unavailable',
        description: 'This stall is not available for booking',
        variant: 'destructive'
      });
      return;
    }
    setSelectedStall(stall);
    setIsModalOpen(true);
  };

  const handleSelectStall = (stall: StallInstance, selectedDates: Date[]) => {
    const pricePerDay = stall.price_override || stall.stall_templates?.price || 0;
    const totalCost = pricePerDay * selectedDates.length;

    setStallSelection({
      stall,
      selectedDates,
      totalCost
    });
    setIsModalOpen(false);
    
    toast({
      title: 'Stall Selected',
      description: `${stall.label} selected for ${selectedDates.length} days`,
    });
  };

  const handleProceedToCheckout = () => {
    if (!stallSelection) return;
    
    // Store selection in sessionStorage for checkout page
    sessionStorage.setItem('fcaBooking', JSON.stringify({
      marketId,
      stallSelection
    }));
    
    navigate(`/admin/fca/checkout`);
  };

  if (stallsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/fca/markets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Markets
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{currentMarket?.name}</h1>
            <p className="text-muted-foreground">Select a stall for offline booking</p>
          </div>
        </div>
        <Badge variant="outline">
          <Briefcase className="h-4 w-4 mr-2" />
          FCA Mode
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stalls.map((stall) => {
          const pricePerDay = stall.price_override || stall.stall_templates?.price || 0;
          const isBooked = stall.isBooked;
          const isHeld = stall.isHeld;

          return (
            <Card 
              key={stall.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isBooked ? 'opacity-60 cursor-not-allowed' : ''
              } ${stallSelection?.stall.id === stall.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => !isBooked && handleStallClick(stall)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{stall.label}</span>
                  <Badge variant={isBooked ? 'destructive' : isHeld ? 'secondary' : 'default'}>
                    {isBooked ? 'Booked' : isHeld ? 'Held' : 'Available'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price/Day:</span>
                  <span className="font-medium">${pricePerDay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium">{stall.stall_templates?.name || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stallSelection && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Selected Stall</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stall:</span>
                <span className="font-medium">{stallSelection.stall.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days:</span>
                <span className="font-medium">{stallSelection.selectedDates.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-lg">${stallSelection.totalCost.toFixed(2)}</span>
              </div>
            </div>
            <Button className="w-full" onClick={handleProceedToCheckout}>
              Proceed to Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedStall && (
        <EnhancedStallModal
          stall={selectedStall}
          market={currentMarket!}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelectStall={handleSelectStall}
        />
      )}
    </div>
  );
};

export default FCAStallBooking;
