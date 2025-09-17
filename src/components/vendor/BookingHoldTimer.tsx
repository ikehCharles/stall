import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BookingHoldTimerProps {
  bookingId: string;
  expiresAt: string | null;
  onExpired?: () => void;
}

export function BookingHoldTimer({ bookingId, expiresAt, onExpired }: BookingHoldTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const expireBookingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('expire_booking', {
        booking_id: bookingId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-details'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      onExpired?.();
      toast({
        title: 'Booking Expired',
        description: 'Your hold on this booking has expired and the stalls are now available for others.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      return Math.max(0, diff);
    };

    const checkExpiry = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        expireBookingMutation.mutate();
      }
    };

    // Initial check
    checkExpiry();

    // Set up interval to check every second
    const timer = setInterval(checkExpiry, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, bookingId, isExpired, expireBookingMutation]);

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

  if (!expiresAt) return null;

  if (isExpired || timeLeft <= 0) {
    return (
      <Badge variant="destructive" className="animate-pulse">
        <AlertCircle className="w-3 h-3 mr-1" />
        Expired
      </Badge>
    );
  }

  const isUrgent = timeLeft < 5 * 60 * 1000; // Less than 5 minutes

  return (
    <Badge 
      variant={isUrgent ? "destructive" : "secondary"} 
      className={isUrgent ? "animate-pulse bg-orange-100 text-orange-800 border-orange-200" : "bg-blue-100 text-blue-800 border-blue-200"}
    >
      <Clock className="w-3 h-3 mr-1" />
      Hold expires in {formatTime(timeLeft)}
    </Badge>
  );
}