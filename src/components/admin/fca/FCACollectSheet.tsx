import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Banknote, QrCode, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FCACollectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  bookingId: string;
  onSuccess: (method: 'card' | 'cash', bookingId: string) => void;
}

type PaymentState = 'idle' | 'processing' | 'success' | 'failed';

export const FCACollectSheet = ({ open, onOpenChange, amount, bookingId, onSuccess }: FCACollectSheetProps) => {
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'cash' | null>(null);

  const simulatePayment = async (method: 'card' | 'cash') => {
    setSelectedMethod(method);
    setPaymentState('processing');

    // Simulate device interaction for 2-3 seconds
    await new Promise(resolve => setTimeout(resolve, 2500));

    // For demo: 90% success rate
    const success = Math.random() > 0.1;

    if (success) {
      setPaymentState('success');
      toast({
        title: 'Payment Successful',
        description: `${method === 'card' ? 'Card' : 'Cash'} payment of $${amount.toFixed(2)} collected successfully`,
      });
      
      // Wait a moment before calling success and closing
      setTimeout(() => {
        onSuccess(method, bookingId);
        handleReset();
      }, 1500);
    } else {
      setPaymentState('failed');
      toast({
        title: 'Payment Failed',
        description: 'Please try again or use a different payment method',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setPaymentState('idle');
    setSelectedMethod(null);
    onOpenChange(false);
  };

  const renderPaymentState = () => {
    if (paymentState === 'processing') {
      return (
        <div className="py-12 text-center space-y-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Processing Payment...</h3>
            <p className="text-sm text-muted-foreground">
              {selectedMethod === 'card' 
                ? 'Please follow instructions on the card machine' 
                : 'Confirming cash payment...'}
            </p>
          </div>
        </div>
      );
    }

    if (paymentState === 'success') {
      return (
        <div className="py-12 text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-green-600">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground">
              Booking confirmed. Redirecting...
            </p>
          </div>
        </div>
      );
    }

    if (paymentState === 'failed') {
      return (
        <div className="py-12 text-center space-y-6">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-destructive">Payment Failed</h3>
            <p className="text-sm text-muted-foreground">
              The payment could not be processed. Please try again.
            </p>
          </div>
          <Button onClick={handleReset} variant="outline" className="w-full">
            Try Again
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Amount Due:</span>
            <span className="text-2xl font-bold">${amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Select Payment Method:</h3>
          
          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start hover:border-primary"
            onClick={() => simulatePayment('card')}
          >
            <CreditCard className="h-5 w-5 mr-3" />
            <div className="text-left flex-1">
              <div className="font-semibold">Card Machine (Zettle)</div>
              <div className="text-xs text-muted-foreground">Tap, insert, or swipe card</div>
            </div>
            <Badge variant="default">Recommended</Badge>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start hover:border-primary"
            onClick={() => simulatePayment('cash')}
          >
            <Banknote className="h-5 w-5 mr-3" />
            <div className="text-left flex-1">
              <div className="font-semibold">Cash Payment</div>
              <div className="text-xs text-muted-foreground">Collect exact cash amount</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start opacity-50 cursor-not-allowed"
            disabled
          >
            <QrCode className="h-5 w-5 mr-3" />
            <div className="text-left flex-1">
              <div className="font-semibold">QR Code Payment</div>
              <div className="text-xs text-muted-foreground">Coming soon</div>
            </div>
            <Badge variant="secondary">Soon</Badge>
          </Button>
        </div>

        {import.meta.env.DEV && (
          <div className="pt-4 border-t space-y-2">
            <p className="text-xs text-muted-foreground">Dev Tools:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                setPaymentState('success');
                setTimeout(() => {
                  onSuccess('card', bookingId);
                  handleReset();
                }, 1000);
              }}>
                Force Success
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPaymentState('failed')}>
                Force Failure
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={paymentState === 'idle' ? onOpenChange : undefined}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Collect Payment</SheetTitle>
          <SheetDescription>
            Process offline payment for this booking
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          {renderPaymentState()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
