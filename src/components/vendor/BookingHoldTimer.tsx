import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SKIP_STATUSES = ['expired', 'cancelled', 'completed', 'reserved'];
const SKIP_PAYMENT_STATUSES = ['success', 'authorized', 'refunded'];

interface BookingHoldTimerProps {
  hideBadge?: boolean;
  bookingId: string;
  expiresAt: string | null;
  bookingStatus?: string;
  paymentStatus?: string | null;
  onExpired?: () => void;
}

export function BookingHoldTimer({
  bookingId,
  expiresAt,
  bookingStatus,
  paymentStatus,
  onExpired,
  hideBadge,
}: BookingHoldTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const shouldSkip =
    !expiresAt ||
    (bookingStatus && SKIP_STATUSES.includes(bookingStatus)) ||
    (paymentStatus && SKIP_PAYMENT_STATUSES.includes(paymentStatus));

  const expireBookingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('expire_booking', {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-details'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      onExpired?.();
      toast({
        title: 'Booking Expired',
        description:
          'Your hold on this booking has expired and the stalls are now available for others.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (shouldSkip) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt!).getTime();
      return Math.max(0, expiry - now);
    };

    const checkExpiry = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        expireBookingMutation.mutate();
      }
    };

    checkExpiry();
    const timer = setInterval(checkExpiry, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, bookingId, isExpired, shouldSkip, expireBookingMutation]);

  if (shouldSkip) return null;

  if (isExpired || timeLeft <= 0) {
    return (
      <Badge variant="destructive" className="animate-pulse">
        <AlertCircle className="w-3 h-3 mr-1" />
        Expired
      </Badge>
    );
  }

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isUrgent = timeLeft < 5 * 60 * 1000;

  return (
    <>
      {!hideBadge && (
        <Badge
          variant={isUrgent ? 'destructive' : 'secondary'}
          className={
            isUrgent
              ? 'animate-pulse bg-orange-100 text-orange-800 border-orange-200'
              : 'bg-blue-100 text-blue-800 border-blue-200'
          }
        >
          <Clock className="w-3 h-3 mr-1" />
          Hold expires in {formatTime(timeLeft)}
        </Badge>
      )}
    </>
  );
}
