
CREATE INDEX IF NOT EXISTS booking_dates_stall_instance_id_booking_date_idx
  ON public.booking_dates (stall_instance_id, booking_date);

CREATE OR REPLACE FUNCTION public.update_stall_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  UPDATE stall_instances si
  SET status = CASE
    WHEN (
      SELECT COUNT(DISTINCT bd.booking_date)
      FROM booking_dates bd
      WHERE bd.stall_instance_id = si.id
    ) >= (
      SELECT COUNT(*)
      FROM generate_series(
        (SELECT start_at::date FROM markets WHERE id = si.market_id),
        (SELECT end_at::date FROM markets WHERE id = si.market_id),
        '1 day'
      )
    )
    THEN 'BOOKED'::public.stall_status
    ELSE 'AVAILABLE'::public.stall_status
  END
  WHERE si.id = COALESCE(NEW.stall_instance_id, OLD.stall_instance_id);
  RETURN NEW;
END;$function$
;

DROP TRIGGER IF EXISTS update_stall_status ON public.booking_dates;

CREATE TRIGGER update_stall_status AFTER DELETE OR UPDATE ON public.booking_dates FOR EACH ROW EXECUTE FUNCTION update_stall_status();


