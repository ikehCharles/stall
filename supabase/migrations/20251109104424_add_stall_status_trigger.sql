set check_function_bodies = off;

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
  WHERE si.id = NEW.stall_instance_id;
  RETURN NEW;
END;$function$
;

CREATE TRIGGER update_stall_status AFTER DELETE OR UPDATE ON public.booking_dates FOR EACH ROW EXECUTE FUNCTION update_stall_status();


