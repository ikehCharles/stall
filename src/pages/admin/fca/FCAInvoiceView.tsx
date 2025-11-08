import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBookingDetails } from '@/hooks/useBookings';
import { Loader2, ArrowLeft, Briefcase, CreditCard } from 'lucide-react';
import InvoiceView from '@/pages/vendor/InvoiceView';
import { FCACollectSheet } from '@/components/admin/fca/FCACollectSheet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const FCAInvoiceView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: booking, isLoading } = useBookingDetails(id || '');
  const [showCollectSheet, setShowCollectSheet] = useState(false);

  const handlePaymentSuccess = async (method: 'card' | 'cash', bookingId: string) => {
    try {
      const { error } = await supabase.rpc('simulate_payment_success', {
        p_booking_id: bookingId
      });

      if (error) throw error;

      await supabase
        .from('bookings')
        .update({ 
          fca_notes: `FCA on-site ${method} payment - collected and confirmed` 
        })
        .eq('id', bookingId);
      
      toast({
        title: 'Payment Confirmed',
        description: `Payment processed successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to process payment',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground">Invoice not found</h2>
        <Button asChild className="mt-4">
          <div onClick={() => navigate('/admin/fca/markets')}>Back to Markets</div>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="px-6 pt-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/fca/markets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Markets
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Booking Confirmation</h1>
        </div>
        <div className="flex items-center gap-3">
          {booking.payment_status === 'pending' && (
            <Button 
              size="lg"
              onClick={() => setShowCollectSheet(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Collect Payment
            </Button>
          )}
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

      <InvoiceView />

      <FCACollectSheet
        open={showCollectSheet}
        onOpenChange={setShowCollectSheet}
        amount={booking.total_amount - booking.paid_amount}
        bookingId={booking.id}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default FCAInvoiceView;
