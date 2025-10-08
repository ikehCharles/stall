import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useActivityFeed = (limit: number = 20) => {
  return useQuery({
    queryKey: ['activity-feed', limit],
    queryFn: async () => {
      // 1. Recent bookings - get user info separately
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, created_at, status, user_id, market_id')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (bookingsError) {
        console.error('Error fetching bookings for activity feed:', bookingsError);
      }

      // Get user profiles for bookings
      const userIds = bookings?.map(b => b.user_id).filter(Boolean) || [];
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      // Get market names
      const marketIds = bookings?.map(b => b.market_id).filter(Boolean) || [];
      const { data: markets } = await supabase
        .from('markets')
        .select('id, name')
        .in('id', marketIds);

      // 2. Recent KYC audit logs
      const { data: kycAudits, error: kycError } = await supabase
        .from('kyc_audit_log')
        .select('id, created_at, to_status, reviewed_by')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (kycError) {
        console.error('Error fetching KYC audits for activity feed:', kycError);
      }

      // Get reviewer profiles
      const reviewerIds = kycAudits?.map(k => k.reviewed_by).filter(Boolean) || [];
      const { data: reviewerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', reviewerIds);

      // Create lookup maps
      const profileMap = new Map(userProfiles?.map(p => [p.id, p.full_name]));
      const marketMap = new Map(markets?.map(m => [m.id, m.name]));
      const reviewerMap = new Map(reviewerProfiles?.map(p => [p.id, p.full_name]));

      // Transform and combine
      const bookingActivities = bookings?.map(b => ({
        id: `booking-${b.id}`,
        timestamp: b.created_at,
        type: 'booking' as const,
        actor: profileMap.get(b.user_id) || 'Unknown User',
        action: `Created booking for ${marketMap.get(b.market_id) || 'market'}`,
        status: b.status || 'pending'
      })) || [];

      const kycActivities = kycAudits?.map(k => ({
        id: `kyc-${k.id}`,
        timestamp: k.created_at,
        type: 'kyc' as const,
        actor: reviewerMap.get(k.reviewed_by) || 'System',
        action: `KYC ${k.to_status?.toLowerCase() || 'updated'}`,
        status: k.to_status || 'PENDING'
      })) || [];

      // Merge and sort by timestamp
      const allActivities = [...bookingActivities, ...kycActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      return allActivities;
    },
    staleTime: 10000, // Cache for 10 seconds
  });
};
