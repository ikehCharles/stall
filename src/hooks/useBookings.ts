import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PlatformSettings } from "@/hooks/useSettings";
import { StallInstance } from "./useStallInstances";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type BookingInsert = Database["public"]["Tables"]["bookings"]["Insert"];
type BookingStall = Database["public"]["Tables"]["booking_stalls"]["Row"];

export interface BookingWithStalls extends Booking {
  booking_stalls: (BookingStall & {
    stall_instances: StallInstance
  })[];
  markets: {
    name: string;
    start_at: string;
    end_at: string;
    theme: string;
  };
  profile?: {
    full_name: string | null;
    email: string;
    phone_number: string | null;
    company_name: string | null;
    address: string | null;
    kyc_application?: {
      status: Database['public']['Enums']['kyc_status'];
    };
  };
  booking_dates?: {
    id: string;
    stall_instance_id: string;
    booking_date: string;
    status: string;
    checked_in_at: string;
    checked_in_by: string
  }[];
}

export const useVendorBookings = () => {
  return useQuery({
    queryKey: ["vendor-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          markets(name, start_at, end_at, theme),
          booking_stalls(
            *,
            stall_instances(*,
              stall_templates(name)
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BookingWithStalls[];
    },
  });
};

export const useVendorSuccessBookingCount = () => {
  return useQuery({
    queryKey: ["vendor-success-booking-count"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("payment_status", "success");

      if (error) throw error;
      return count ?? 0;
    },
  });
};

export const useBookingDetails = (bookingId: string) => {
  return useQuery({
    queryKey: ["booking-details", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          markets(name, start_at, end_at, theme),
          booking_stalls(
            *,
            stall_instances(
              id,
              label,
              x,
              y,
              width,
              height,
              stall_templates(name)
            )
          ),
          booking_dates(
            id,
            stall_instance_id,
            booking_date,
            status
          )
        `
        )
        .eq("id", bookingId)
        .single();

      if (error) throw error;

      // Fetch profile separately using user_id
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          `full_name, email, phone_number, company_name, address,
        kyc_application:kyc_applications!fk_kyc_applications_user_id(
          status
        )
        `
        )
        .eq("id", data.user_id)
        .single();

      return {
        ...data,
        profile: profile || undefined,
      } as BookingWithStalls;
    },
    enabled: !!bookingId,
  });
};

export const useFetchBookingDetails = () => {
  return useMutation({
    mutationFn: async (
      bookingId: string
    ): Promise<BookingWithStalls | null> => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          markets(name, start_at, end_at, theme),
          booking_stalls(
            *,
            stall_instances(
              id,
              label,
              x,
              y,
              width,
              height,
              stall_templates(name)
            )
          ),
          booking_dates(
            id,
            stall_instance_id,
            booking_date,
            status,
            checked_in_at
          )
        `
        )
        .eq("id", bookingId)
        .single();

      if (error) throw error;

      // Fetch profile separately using user_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          `full_name, email, phone_number, company_name, address,
        kyc_application:kyc_applications!fk_kyc_applications_user_id(
          status
        )
        `
        )
        .eq("id", data.user_id)
        .single();


      return {
        ...data,
        profile: profile || undefined,
      } as BookingWithStalls;
    },
  });
};

export interface CreateBookingData {
  marketId: string;
  stallIds: string[];
  totalAmount: number;
  selectedDates?: string[];
  pricePerDay?: number;
  // FCA-specific fields
  vendorId?: string; // For FCA creating booking for vendor
  createdByFcaId?: string; // Track FCA user
  fcaNotes?: string; // Optional notes
  payLater?: boolean;
}

export const useCreateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingData: CreateBookingData,) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Use vendorId if provided (FCA creating for vendor), otherwise current user
      const bookingUserId = bookingData.vendorId || user.id;

      // Validate 5-day maximum
      const daysCount = bookingData.selectedDates?.length || 1;
      if (daysCount > 5) {
        throw new Error("Maximum 5 days can be selected per booking");
      }
      if (daysCount < 1) {
        throw new Error("At least 1 day must be selected");
      }

      // Generate invoice number
      const { data: invoiceNumber, error: invoiceError } = await supabase.rpc(
        "generate_invoice_number"
      );

      if (invoiceError) throw invoiceError;

      const pricePerDay =
        bookingData.pricePerDay || bookingData.totalAmount / daysCount;

      // Determine status based on FCA context (auto-approve FCA bookings)
      const bookingStatus = bookingData.createdByFcaId || bookingData.payLater ? "reserved" : "pending";

      // Booking expiration from platform settings: when active, use configured minutes; else never expire (null)
      const settings = queryClient.getQueryData<PlatformSettings>(["platform-settings"]);
      const useExpiration =
        !!settings?.bookingExpirationActive &&
        typeof settings?.bookingExpiration === "number" &&
        settings.bookingExpiration >= 1;
      const holdExpiresAt =
        useExpiration && settings && !bookingData.payLater
          ? new Date(Date.now() + settings.bookingExpiration * 60 * 1000).toISOString()
          : null;

      // Get VAT settings
      const vatRate = settings?.vatRate ?? 20;
      const vatMode = settings?.vatMode ?? "exclusive";

      // Create the booking with hold expiry and new status
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          user_id: bookingUserId, // Vendor, not FCA
          market_id: bookingData.marketId,
          total_amount: bookingData.totalAmount,
          paid_amount: 0,
          status: bookingStatus, // 'approved' for FCA bookings
          invoice_number: invoiceNumber,
          selected_dates: bookingData.selectedDates,
          days_count: daysCount,
          price_per_day: pricePerDay,
          hold_expires_at: holdExpiresAt,
          created_by_fca_id: bookingData.createdByFcaId, // Track FCA user
          fca_notes: bookingData.fcaNotes, // Optional notes
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create VAT ledger entry (also updates booking with VAT fields)
      try {
        await supabase.rpc("create_vat_ledger_entry", {
          p_booking_id: booking.id,
          p_vendor_id: bookingUserId,
          p_invoice_number: invoiceNumber,
          p_total_amount: bookingData.totalAmount,
          p_vat_rate: vatRate,
          p_vat_mode: vatMode,
        });
      } catch (_vatError) {
        // Non-blocking: booking proceeds even if VAT ledger fails
      }

      // Create booking_stalls entries
      const bookingStalls = bookingData.stallIds.map((stallId) => ({
        booking_id: booking.id,
        stall_instance_id: stallId,
        price_at_booking: pricePerDay,
      }));

      const { error: stallsError } = await supabase
        .from("booking_stalls")
        .insert(bookingStalls);

      if (stallsError) throw stallsError;

      // If dates are specified, create booking_dates entries
      if (bookingData.selectedDates && bookingData.selectedDates.length > 0) {
        const bookingDates = [];
        for (const stallId of bookingData.stallIds) {
          for (const date of bookingData.selectedDates) {
            bookingDates.push({
              booking_id: booking.id,
              stall_instance_id: stallId,
              booking_date: date,
            });
          }
        }

        const { error: datesError } = await supabase
          .from("booking_dates")
          .insert(bookingDates);

        if (datesError) throw datesError;
      }

      // Clean up any holds for this user and these stalls
      const { error: holdError } = await supabase
        .from("stall_holds")
        .delete()
        .eq("user_id", bookingUserId)
        .in("stall_instance_id", bookingData.stallIds);

      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["stall-instances"] });
      queryClient.invalidateQueries({ queryKey: ["booking-dates"] });
      queryClient.invalidateQueries({ queryKey: ["stall-holds"] });
    },
  });
};

// Payment stub functionality - now only handles payment status
export const usePaymentStub = () => {
  return useMutation({
    mutationFn: async (bookingId: string) => {
      // Simulate payment processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update payment status to success
      const { data, error } = await supabase.rpc("simulate_payment_success", {
        p_booking_id: bookingId,
      });

      if (error) throw error;
      return data;
    },
  });
};

// Manual cancellation functionality
export const useCancelBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc("cancel_booking", {
        p_booking_id: bookingId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-details"] });
      queryClient.invalidateQueries({ queryKey: ["stall-holds"] });
      queryClient.invalidateQueries({ queryKey: ["stall-instances"] });
      queryClient.invalidateQueries({ queryKey: ["booking-dates"] });
    },
  });
};

// Manual reserve booking functionality
export const useReserveBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc("reserve_booking", {
        p_booking_id: bookingId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-details"] });
      queryClient.invalidateQueries({ queryKey: ["stall-holds"] });
      queryClient.invalidateQueries({ queryKey: ["stall-instances"] });
      queryClient.invalidateQueries({ queryKey: ["booking-dates"] });
    },
  });
};

// Expire an unpaid booking whose hold has passed (sets status to 'expired')
export const useExpireBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc("expire_booking", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ["booking-details", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
  });
};

export const useCheckInVendor = () => {
  return useMutation({
    mutationFn: async ({
      bookingDateId,
      bookingId,
    }: {
      bookingId: string;
      bookingDateId: string;
    }) => {
      const { data, error } = await supabase.rpc("checkin_vendor", {
        p_booking_date_id: bookingDateId,
        p_booking_id: bookingId,
      });

      if (error) throw error;
      return data;
    }
  });
};
export const useUndoCheckInVendor = () => {
  return useMutation({
    mutationFn: async ({
      bookingDateId,
      bookingId,
    }: {
      bookingId: string;
      bookingDateId: string;
    }) => {
      const { data, error } = await supabase.rpc("undo_checkin_vendor", {
        p_booking_date_id: bookingDateId,
        p_booking_id: bookingId,
      });

      if (error) throw error;
      return data;
    }
  });
};
