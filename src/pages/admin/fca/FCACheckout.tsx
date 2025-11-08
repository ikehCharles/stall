import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { FCACollectSheet } from '@/components/admin/fca/FCACollectSheet';
import { useCreateBooking, CreateBookingData } from '@/hooks/useBookings';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const FCACheckout = () => {
  const navigate = useNavigate();
  const [showCollectSheet, setShowCollectSheet] = useState(false);
  const [bookingData, setBookingData] = useState<any>(null);
  const createBooking = useCreateBooking();

  useEffect(() => {
    // Retrieve booking data from sessionStorage
    const stored = sessionStorage.getItem('fcaBooking');
    if (!stored) {
      toast({
        title: 'No Booking Data',
        description: 'Please select a stall first',
        variant: 'destructive',
      });
      navigate('/admin/fca/markets');
      return;
    }

    try {
      const data = JSON.parse(stored);
      setBookingData(data);
    } catch (error) {
      toast({
        title: 'Invalid Booking Data',
        description: 'Please start over',
        variant: 'destructive',
      });
      navigate('/admin/fca/markets');
    }
  }, [navigate]);

  const handlePaymentSuccess = async (method: 'card' | 'cash') => {
    if (!bookingData) return;

    const { marketId, stallSelection } = bookingData;

    const pricePerDay = stallSelection.stall.price_override || stallSelection.stall.stall_templates?.price || 0;

    // Create booking with immediate payment confirmation
    const bookingPayload: CreateBookingData = {
      marketId,
      stallIds: [stallSelection.stall.id],
      totalAmount: stallSelection.totalCost,
      selectedDates: stallSelection.selectedDates.map((date: Date) => format(new Date(date), 'yyyy-MM-dd')),
      pricePerDay,
    };

    try {
      const result = await createBooking.mutateAsync(bookingPayload);
      
      // Clear session storage
      sessionStorage.removeItem('fcaBooking');

      toast({
        title: 'Booking Created',
        description: `Offline ${method} payment processed successfully`,
      });

      // Navigate to invoice
      navigate(`/admin/fca/invoices/${result.id}`);
    } catch (error: any) {
      toast({
        title: 'Booking Failed',
        description: error.message || 'Failed to create booking',
        variant: 'destructive',
      });
    }
  };

  if (!bookingData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const { stallSelection } = bookingData;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Payment Summary</h1>
        </div>
        <Badge variant="outline">
          <Briefcase className="h-4 w-4 mr-2" />
          FCA - Offline Only
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stall:</span>
              <span className="font-medium">{stallSelection.stall.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Template:</span>
              <span className="font-medium">{stallSelection.stall.stall_templates?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Days:</span>
              <span className="font-medium">{stallSelection.selectedDates.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price per Day:</span>
              <span className="font-medium">
                ${(stallSelection.stall.price_override || stallSelection.stall.stall_templates?.price || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <h4 className="text-sm font-medium">Selected Dates:</h4>
            <div className="flex flex-wrap gap-2">
              {stallSelection.selectedDates.map((date: Date, idx: number) => (
                <Badge key={idx} variant="secondary">
                  {format(new Date(date), 'MMM d, yyyy')}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subtotal:</span>
              <span className="font-medium">${stallSelection.totalCost.toFixed(2)}</span>
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

          <Button 
            className="w-full mt-4" 
            size="lg"
            onClick={() => setShowCollectSheet(true)}
            disabled={createBooking.isPending}
          >
            Collect Payment
          </Button>
        </CardContent>
      </Card>

      <FCACollectSheet
        open={showCollectSheet}
        onOpenChange={setShowCollectSheet}
        amount={stallSelection.totalCost}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default FCACheckout;
