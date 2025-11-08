import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { useMarkets } from '@/hooks/useMarkets';
import { useStallInstances } from '@/hooks/useStallInstances';
import { useStallHolds } from '@/hooks/useStallHolds';
import { useBookingDates } from '@/hooks/useBookingDates';
import { FCABookingModal } from '@/components/admin/fca/FCABookingModal';
import { Loader2 } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay } from 'date-fns';

type StallInstance = {
  id: string;
  label: string;
  status: string;
  price_override: number | null;
  stall_templates?: {
    name: string;
    price: number;
  };
};

const FCAStallBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedStall, setSelectedStall] = useState<StallInstance | null>(null);
  const [showModal, setShowModal] = useState(false);

  const market = useMarkets();
  const stalls = useStallInstances(id || '');
  const stallHolds = useStallHolds(id || '');
  const bookingDates = useBookingDates(id || '');

  const currentMarket = market.data?.find(m => m.id === id);

  const handleStallClick = (stall: StallInstance) => {
    if (stall.status === 'AVAILABLE') {
      setSelectedStall(stall);
      setShowModal(true);
    }
  };

  // Get booked dates for the selected stall
  const getBookedDatesForStall = (stallId: string): Date[] => {
    if (!bookingDates.data || !currentMarket) return [];
    
    return bookingDates.data
      .filter(bd => bd.stall_instance_id === stallId)
      .map(bd => startOfDay(new Date(bd.booking_date)));
  };

  // Check if stall has ANY available date in market window
  const isStallAvailable = (stall: StallInstance): boolean => {
    if (!currentMarket) return false;
    
    const marketDates = eachDayOfInterval({
      start: startOfDay(new Date(currentMarket.start_at)),
      end: startOfDay(new Date(currentMarket.end_at))
    });
    
    const bookedDates = getBookedDatesForStall(stall.id);
    
    // Available if at least ONE date in market window is not booked
    return marketDates.some(marketDate => 
      !bookedDates.some(bookedDate => 
        bookedDate.getTime() === marketDate.getTime()
      )
    );
  };

  if (stalls.isLoading || market.isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!currentMarket) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Market not found</h2>
          <Button onClick={() => navigate('/admin/fca/markets')} className="mt-4">
            Back to Markets
          </Button>
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
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{currentMarket.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(currentMarket.start_at), 'MMM d')} - {format(new Date(currentMarket.end_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <Badge variant="outline">
          <Briefcase className="h-4 w-4 mr-2" />
          FCA Mode
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stalls.data?.map((stall) => {
          const available = isStallAvailable(stall);
          const statusVariant = available ? 'default' : 'destructive';
          const statusText = available ? 'Available' : 'Booked';

          return (
            <Card 
              key={stall.id} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                available ? 'hover:border-primary' : 'opacity-60'
              }`}
              onClick={() => handleStallClick(stall)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{stall.label}</CardTitle>
                  <Badge variant={statusVariant}>
                    {statusText}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <strong>Template:</strong> {stall.stall_templates?.name || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Price:</strong> ${(stall.price_override || stall.stall_templates?.price || 0).toFixed(2)}/day
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FCABookingModal
        open={showModal}
        onOpenChange={setShowModal}
        stall={selectedStall}
        market={currentMarket}
        bookedDates={selectedStall ? getBookedDatesForStall(selectedStall.id) : []}
      />
    </div>
  );
};

export default FCAStallBooking;
