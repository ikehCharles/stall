-- Add RLS policy to allow vendors to view stall instances in published markets
CREATE POLICY "Vendors can view stall instances in published markets" 
ON public.stall_instances 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.markets 
  WHERE markets.id = stall_instances.market_id 
  AND markets.status = 'PUBLISHED'::market_status
));