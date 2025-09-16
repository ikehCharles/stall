-- Add RLS policy to allow vendors to view published markets
CREATE POLICY "Vendors can view published markets" 
ON public.markets 
FOR SELECT 
USING (status = 'PUBLISHED'::market_status);