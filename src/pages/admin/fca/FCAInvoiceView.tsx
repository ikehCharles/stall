import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBookingDetails } from '@/hooks/useBookings';
import { Loader2, ArrowLeft, Briefcase } from 'lucide-react';
import InvoiceView from '@/pages/vendor/InvoiceView';

const FCAInvoiceView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: booking, isLoading } = useBookingDetails(id || '');

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
        <Badge variant="outline">
          <Briefcase className="h-4 w-4 mr-2" />
          FCA Mode
        </Badge>
      </div>

      <InvoiceView />
    </div>
  );
};

export default FCAInvoiceView;
