import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { VendorLookup } from './VendorLookup';
import { BookingCalendar } from '@/components/vendor/BookingCalendar';
import { useUnpaidInvoice, VendorLookupResult } from '@/hooks/useVendorLookup';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertCircle, Calendar, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FCABookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stall: any;
  market: any;
  bookedDates: Date[];
}

type ModalState = 'vendor_lookup' | 'unpaid_invoice' | 'date_selection';

export const FCABookingModal = ({ 
  open, 
  onOpenChange, 
  stall, 
  market,
  bookedDates 
}: FCABookingModalProps) => {
  const navigate = useNavigate();
  const [state, setState] = useState<ModalState>('vendor_lookup');
  const [vendor, setVendor] = useState<VendorLookupResult | null>(null);
  const [unpaidInvoice, setUnpaidInvoice] = useState<any>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  
  const unpaidInvoiceMutation = useUnpaidInvoice();

  useEffect(() => {
    if (!open) {
      setState('vendor_lookup');
      setVendor(null);
      setUnpaidInvoice(null);
      setSelectedDates([]);
    }
  }, [open]);

  const handleVendorFound = async (foundVendor: VendorLookupResult) => {
    setVendor(foundVendor);

    // Check if vendor has unpaid invoice for this stall (Scenario A)
    if (foundVendor.has_unpaid_bookings) {
      unpaidInvoiceMutation.mutate(
        { stallId: stall.id, vendorId: foundVendor.user_id },
        {
          onSuccess: (invoice) => {
            if (invoice) {
              setUnpaidInvoice(invoice);
              setState('unpaid_invoice');
            } else {
              // Has unpaid bookings but not for this stall
              proceedToDateSelection(foundVendor);
            }
          },
          onError: () => {
            toast({
              title: 'Error',
              description: 'Failed to check for unpaid invoices',
              variant: 'destructive',
            });
          }
        }
      );
    } else {
      // No unpaid bookings, proceed to date selection (Scenario B)
      proceedToDateSelection(foundVendor);
    }
  };

  const proceedToDateSelection = (foundVendor: VendorLookupResult) => {
    if (foundVendor.kyc_status !== 'APPROVED') {
      toast({
        title: 'KYC Not Approved',
        description: 'Vendor must have approved KYC to book. Scenario C is not available in this MVP.',
        variant: 'destructive',
      });
      return;
    }
    setState('date_selection');
  };

  const handleVendorNotFound = () => {
    toast({
      title: 'Vendor Not Found',
      description: 'Scenario C (new vendor registration) is not available in this MVP.',
      variant: 'destructive',
    });
  };

  const handleProceedWithUnpaidInvoice = () => {
    // Navigate directly to invoice view for payment
    navigate(`/admin/fca/invoices/${unpaidInvoice.booking_id}`);
    onOpenChange(false);
  };

  const handleContinueToCheckout = () => {
    if (selectedDates.length === 0) {
      toast({
        title: 'No Dates Selected',
        description: 'Please select at least one date',
        variant: 'destructive',
      });
      return;
    }

    const pricePerDay = stall.price_override || stall.stall_templates?.price || 0;
    const totalCost = pricePerDay * selectedDates.length;

    // Store booking data in session storage
    sessionStorage.setItem('fcaBooking', JSON.stringify({
      marketId: market.id,
      vendorId: vendor?.user_id,
      vendorDetails: vendor,
      stallSelection: {
        stall,
        selectedDates,
        totalCost,
      }
    }));

    navigate('/admin/fca/checkout');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            FCA Booking - {stall?.label}
            {state === 'unpaid_invoice' && (
              <Badge variant="destructive">Unpaid Invoice</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stall Details */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stall:</span>
                  <span className="font-medium">{stall?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium">{stall?.stall_templates?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per Day:</span>
                  <span className="font-medium">
                    ${(stall?.price_override || stall?.stall_templates?.price || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Scenario A: Unpaid Invoice */}
          {state === 'unpaid_invoice' && unpaidInvoice && (
            <div className="space-y-4">
              <Card className="border-orange-500 bg-orange-500/10">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertCircle className="h-5 w-5" />
                    <h4 className="font-semibold">Unpaid Invoice Found</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This vendor has an existing unpaid booking for this stall.
                  </p>
                  
                  <Separator />
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice:</span>
                      <span className="font-mono">{unpaidInvoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="font-semibold">${unpaidInvoice.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outstanding:</span>
                      <span className="font-semibold text-orange-700 dark:text-orange-400">
                        ${unpaidInvoice.outstanding_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-sm font-medium">Booking Dates:</p>
                    <div className="flex flex-wrap gap-2">
                      {unpaidInvoice.booking_dates.map((date: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(date), 'MMM d, yyyy')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleProceedWithUnpaidInvoice}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Proceed to Payment
              </Button>
            </div>
          )}

          {/* Scenario B: Date Selection */}
          {state === 'date_selection' && vendor && (
            <div className="space-y-4">
              {vendor && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vendor:</span>
                        <span className="font-medium">{vendor.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">KYC Status:</span>
                        <Badge variant="default">APPROVED</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <BookingCalendar
                marketId={market.id}
                stallInstanceId={stall.id}
                marketStartDate={market.start_at}
                marketEndDate={market.end_at}
                selectedDates={selectedDates}
                onDateSelect={setSelectedDates}
                maxDays={5}
              />

              {selectedDates.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Days Selected:</span>
                        <span className="font-medium">{selectedDates.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold text-lg">
                          ${((stall?.price_override || stall?.stall_templates?.price || 0) * selectedDates.length).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleContinueToCheckout}
                disabled={selectedDates.length === 0}
              >
                Continue to Checkout
              </Button>
            </div>
          )}

          {/* Vendor Lookup */}
          {state === 'vendor_lookup' && (
            <VendorLookup
              onVendorFound={handleVendorFound}
              onVendorNotFound={handleVendorNotFound}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
