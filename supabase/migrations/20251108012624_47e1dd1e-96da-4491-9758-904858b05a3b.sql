-- Allow admins/FCAs to create bookings for any user
CREATE POLICY "Admins can create bookings for any user" ON public.bookings
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

-- Allow admins to create booking_stalls for any booking
CREATE POLICY "Admins can create booking stalls for any booking" ON public.booking_stalls
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

-- Allow admins to create booking_dates for any booking
CREATE POLICY "Admins can create booking dates for any booking" ON public.booking_dates
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);