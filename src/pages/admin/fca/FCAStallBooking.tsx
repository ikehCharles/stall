import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Briefcase, LayoutGrid, Map } from 'lucide-react';
import { useMarkets } from '@/hooks/useMarkets';
import { useStallInstances } from '@/hooks/useStallInstances';
import { useStallHolds } from '@/hooks/useStallHolds';
import { useBookingDates } from '@/hooks/useBookingDates';
import { FCABookingModal } from '@/components/admin/fca/FCABookingModal';
import { StallCanvasView } from '@/components/shared/StallCanvasView';
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
  const { marketId } = useParams();
  const navigate = useNavigate();
  const [selectedStall, setSelectedStall] = useState<StallInstance | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');

  const market = useMarkets();
  const stalls = useStallInstances(marketId || '');
  const stallHolds = useStallHolds(marketId || '');
  const bookingDates = useBookingDates(marketId || '');

  const currentMarket = market.data?.find(m => m.id === marketId);

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

  const getStallColorForFCA = (stall: StallInstance) => {
    const available = isStallAvailable(stall);
    if (available) return '#22c55e'; // green - available
    return '#ef4444'; // red - fully booked
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
            Back to Markets
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{currentMarket.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(currentMarket.start_at), 'MMM d')} - {format(new Date(currentMarket.end_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              List View
            </Button>
            <Button
              variant={viewMode === 'canvas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('canvas')}
            >
              <Map className="h-4 w-4 mr-2" />
              Canvas View
            </Button>
          </div>
          <Badge variant="outline">
            <Briefcase className="h-4 w-4 mr-2" />
            FCA Mode
          </Badge>
          <Button 
            variant="outline"
            onClick={() => navigate('/admin')}
            size="sm"
          >
            Exit FCA Mode
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? (
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
      ) : (
        <Card>
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
                Fully Booked
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StallCanvasView
              stalls={stalls.data || []}
              onStallClick={handleStallClick}
              getStallColor={getStallColorForFCA}
            />
          </CardContent>
        </Card>
      )}

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
