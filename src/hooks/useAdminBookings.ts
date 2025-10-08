import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BookingWithStalls } from './useBookings';

export const useAdminBookings = () => {
  return useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_stalls (
            *,
            stall_instances (
              id,
              label,
              x,
              y,
              width,
              height,
              stall_templates (
                id,
                name,
                price,
                shape,
                width,
                height
              )
            )
          ),
          markets (
            id,
            name,
            start_at,
            end_at,
            theme
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BookingWithStalls[];
    },
  });
};

export const useAdminApproveBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('admin_approve_booking', {
        p_booking_id: bookingId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({
        title: 'Booking Approved',
        description: 'The booking has been approved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve booking.',
        variant: 'destructive',
      });
    },
  });
};

export const useAdminDeclineBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('admin_decline_booking', {
        p_booking_id: bookingId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({
        title: 'Booking Declined',
        description: 'The booking has been declined and holds released.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to decline booking.',
        variant: 'destructive',
      });
    },
  });
};