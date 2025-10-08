-- Phase 1: Database Schema Updates for Stall Booking Workflow

-- Create stall_date_status enum
CREATE TYPE stall_date_status AS ENUM ('available', 'reserved', 'booked');

-- Add status column to booking_dates table
ALTER TABLE public.booking_dates 
ADD COLUMN status stall_date_status NOT NULL DEFAULT 'reserved';

-- Update existing booking_dates based on parent booking status
UPDATE public.booking_dates bd
SET status = CASE 
  WHEN EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = bd.booking_id 
    AND b.status IN ('completed', 'approved')
    AND b.payment_status = 'success'
  ) THEN 'booked'::stall_date_status
  ELSE 'reserved'::stall_date_status
END;

-- Add unique constraint on (market_id, label) in stall_instances
-- First check for any duplicate labels and rename them
DO $$
DECLARE
  rec RECORD;
  new_label TEXT;
  counter INTEGER;
BEGIN
  FOR rec IN 
    SELECT market_id, label, COUNT(*) as cnt
    FROM public.stall_instances
    GROUP BY market_id, label
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    FOR rec IN 
      SELECT id, label, market_id
      FROM public.stall_instances
      WHERE market_id = rec.market_id AND label = rec.label
      ORDER BY id
      OFFSET 1
    LOOP
      new_label := rec.label || '-' || counter;
      UPDATE public.stall_instances 
      SET label = new_label 
      WHERE id = rec.id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Add the unique constraint
ALTER TABLE public.stall_instances 
ADD CONSTRAINT stall_instances_market_label_unique UNIQUE (market_id, label);

-- Create function to generate unique stall label for a market
CREATE OR REPLACE FUNCTION public.generate_stall_label(p_market_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_num INTEGER;
  v_new_label TEXT;
BEGIN
  -- Find the highest number from existing stall labels in this market
  -- Labels are expected to be in format ST-001, ST-002, etc.
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(label FROM 'ST-(\d+)') AS INTEGER
      )
    ),
    0
  ) INTO v_max_num
  FROM public.stall_instances
  WHERE market_id = p_market_id
  AND label ~ '^ST-\d+$';
  
  -- Generate new label with zero-padded number
  v_new_label := 'ST-' || LPAD((v_max_num + 1)::TEXT, 3, '0');
  
  -- Ensure uniqueness (in case of manual labels)
  WHILE EXISTS (
    SELECT 1 FROM public.stall_instances 
    WHERE market_id = p_market_id AND label = v_new_label
  ) LOOP
    v_max_num := v_max_num + 1;
    v_new_label := 'ST-' || LPAD((v_max_num + 1)::TEXT, 3, '0');
  END LOOP;
  
  RETURN v_new_label;
END;
$$;

-- Create trigger function for auto-naming stalls
CREATE OR REPLACE FUNCTION public.auto_generate_stall_label()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If label is not provided or is empty, generate one
  IF NEW.label IS NULL OR NEW.label = '' THEN
    NEW.label := generate_stall_label(NEW.market_id);
  -- If label is provided but already exists, generate a unique one
  ELSIF EXISTS (
    SELECT 1 FROM public.stall_instances 
    WHERE market_id = NEW.market_id 
    AND label = NEW.label 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) THEN
    NEW.label := generate_stall_label(NEW.market_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on stall_instances BEFORE INSERT
CREATE TRIGGER trigger_auto_generate_stall_label
BEFORE INSERT ON public.stall_instances
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_stall_label();

-- Update check_stall_date_availability function to consider booking_dates status
CREATE OR REPLACE FUNCTION public.check_stall_date_availability(stall_id uuid, market_id uuid, dates date[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if stall exists and is available
  IF NOT EXISTS (
    SELECT 1 FROM public.stall_instances si
    WHERE si.id = stall_id 
    AND si.market_id = market_id 
    AND si.status = 'AVAILABLE'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if any of the requested dates are already reserved or booked
  IF EXISTS (
    SELECT 1 FROM public.booking_dates bd
    WHERE bd.stall_instance_id = stall_id
    AND bd.booking_date = ANY(dates)
    AND bd.status IN ('reserved', 'booked')
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if any dates are currently held by another user
  IF EXISTS (
    SELECT 1 FROM public.stall_holds sh
    WHERE sh.stall_instance_id = stall_id
    AND sh.market_id = market_id
    AND sh.selected_dates && dates
    AND sh.expires_at > now()
    AND sh.user_id != auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;