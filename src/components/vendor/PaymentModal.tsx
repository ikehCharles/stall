import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BookingWithStalls } from '@/hooks/useBookings';

interface PaymentModalProps {
  booking: BookingWithStalls;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentModal({ booking, isOpen, onClose }: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const paymentSuccessMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('simulate_payment_success', {
        p_booking_id: booking.id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-details'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({
        title: 'Payment Successful',
        description: 'Your payment has been processed successfully.',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Payment Failed',
        description: error.message || 'An error occurred during payment.',
        variant: 'destructive',
      });
    },
  });

  const paymentFailureMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('simulate_payment_failure', {
        p_booking_id: booking.id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-details'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({
        title: 'Payment Failed',
        description: 'Payment failed. Your booking status remains unchanged.',
        variant: 'destructive',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred.',
        variant: 'destructive',
      });
    },
  });

  const handleSimulateSuccess = async () => {
    setIsProcessing(true);
    try {
      await paymentSuccessMutation.mutateAsync();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateFailure = async () => {
    setIsProcessing(true);
    try {
      await paymentFailureMutation.mutateAsync();
    } finally {
      setIsProcessing(false);
    }
  };

  const outstandingAmount = booking.total_amount - booking.paid_amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Simulation</DialogTitle>
          <DialogDescription>
            Simulate payment outcome for booking {booking.invoice_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Market:</span>
              <span className="text-sm">{booking.markets?.name}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Booking Status:</span>
              <Badge variant="secondary">
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Payment Status:</span>
              <Badge variant={booking.payment_status === 'success' ? 'default' : booking.payment_status === 'failed' ? 'destructive' : 'secondary'}>
                {booking.payment_status.charAt(0).toUpperCase() + booking.payment_status.slice(1)}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Amount:</span>
                <span>${booking.total_amount}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Already Paid:</span>
                <span>${booking.paid_amount}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Outstanding:</span>
                <span className="text-primary">${outstandingAmount}</span>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              This is a payment simulation. Choose an outcome to test the booking flow.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <Button
            onClick={handleSimulateSuccess}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? 'Processing...' : 'Simulate Success'}
          </Button>
          <Button
            onClick={handleSimulateFailure}
            disabled={isProcessing}
            variant="destructive"
            className="flex-1"
          >
            {isProcessing ? 'Processing...' : 'Simulate Failure'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}