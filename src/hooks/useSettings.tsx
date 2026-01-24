import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

// Type definitions for settings table
type SettingsRow = {
  id: number;
  created_at: string;
  key: string;
  value: string;
  source: string;
  is_active: boolean;
  meta: Record<string, unknown>;
};

type SettingsInsert = {
  key: string;
  value: string;
  source: string;
  is_active: boolean;
  meta: Record<string, unknown>;
};

type SettingsUpdate = {
  value?: string;
  is_active?: boolean;
  meta?: Record<string, unknown>;
};

export const useCreateCred = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      source,
      key,
      meta,
    }: {
      source: string;
      key: string;
      meta: Record<string, unknown>;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data, error } = await supabase.functions.invoke(
        "create-cred",
        {
          body: {
            source,
            key,
            meta,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["markets"] });
    },
  });
};

// Settings type matching the UI state
export type PlatformSettings = {
  depositPercentage: number;
  platformFee: number;
  autoConfirmBookings: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  maxStallsPerVendor: number;
  minBookings: number;
  minBookingsActive: boolean;
  bookingExpiration: number;
  bookingExpirationActive: boolean;
  cancellationWindow: number;
  refundPolicy: string;
  termsAndConditions: string;
};

// Default settings
const defaultSettings: PlatformSettings = {
  depositPercentage: 50,
  platformFee: 5,
  autoConfirmBookings: true,
  emailNotifications: true,
  smsNotifications: false,
  maxStallsPerVendor: 10,
  minBookings: 1,
  minBookingsActive: true,
  bookingExpiration: 5,
  bookingExpirationActive: true,
  cancellationWindow: 48,
  refundPolicy:
    "Cancellations made 48 hours before the event are eligible for full refund minus processing fees.",
  termsAndConditions:
    "By booking a stall, vendors agree to follow all marketplace guidelines and policies.",
};

// Map UI keys to database keys (*Active flags use is_active of their linked row; no separate key)
const SETTING_KEYS: Record<Exclude<keyof PlatformSettings, "minBookingsActive" | "bookingExpirationActive">, string> = {
  depositPercentage: "deposit_percentage",
  platformFee: "platform_fee",
  autoConfirmBookings: "auto_confirm_bookings",
  emailNotifications: "email_notifications",
  smsNotifications: "sms_notifications",
  maxStallsPerVendor: "max_stalls_per_vendor",
  minBookings: "min_bookings",
  bookingExpiration: "booking_expiration",
  cancellationWindow: "cancellation_window",
  refundPolicy: "refund_policy",
  termsAndConditions: "terms_and_conditions",
};

// Helper type for settings table operations (until types are regenerated)
type SettingsTableQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string | boolean) => Promise<{
      data: SettingsRow[] | null;
      error: Error | null;
    }>;
  };
};

// Fetch all platform settings
export const usePlatformSettings = () => {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      // Type-safe query for settings table (not yet in generated types)
      const settingsQuery = (supabase.from("settings" as never) as unknown) as SettingsTableQuery;
      
      const { data, error } = await settingsQuery
        .select("key, value, is_active")
        .eq("source", "platform");

      if (error) throw error;

      // Transform database settings to UI format
      type SettingRow = { key: string; value: string; is_active: boolean };
      const settingsData = (data || []) as unknown as SettingRow[];
      const settingsMap = new Map<string, { value: string; is_active: boolean }>(
        settingsData.map((s) => [s.key, { value: s.value, is_active: s.is_active }])
      );

      const result: PlatformSettings = { ...defaultSettings };

      // Parse each setting value
      Object.entries(SETTING_KEYS).forEach(([uiKey, dbKey]) => {
        const entry = settingsMap.get(dbKey);
        if (entry) {
          const { value } = entry;
          const typedKey = uiKey as keyof PlatformSettings;
          const defaultValue = defaultSettings[typedKey];

          // Parse based on type
          if (typeof defaultValue === "boolean") {
            (result[typedKey] as boolean) = value === "true" || value === "1";
          } else if (typeof defaultValue === "number") {
            (result[typedKey] as number) = Number(value) || defaultValue;
          } else {
            (result[typedKey] as string) = value;
          }

          // min_bookings row also carries is_active for the "Minimum Bookings" rule
          if (dbKey === "min_bookings") {
            result.minBookingsActive = entry.is_active;
          }
          // booking_expiration row also carries is_active for the "Booking Expiration" rule
          if (dbKey === "booking_expiration") {
            result.bookingExpirationActive = entry.is_active;
          }
        }
      });

      return result;
    },
  });
};

// Save platform settings
type SettingId = { id: number };

// Helper types for settings table mutations
type SettingsTableMutation = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: SettingId | null; error: Error | null }>;
      };
    };
  };
  update: (values: SettingsUpdate) => {
    eq: (column: string, value: number) => Promise<{ error: Error | null }>;
  };
  insert: (values: SettingsInsert) => Promise<{ error: Error | null }>;
};

// Save a single setting
export const useSaveSingleSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      value,
      isActive,
    }: {
      key: keyof PlatformSettings;
      value: string | number | boolean;
      isActive?: boolean;
    }) => {
      const dbKey = SETTING_KEYS[key];
      if (!dbKey) throw new Error(`Unknown setting key: ${key}`);
      const settingValue = String(value);

      // Type-safe operations for settings table
      const settingsTable = (supabase.from("settings" as never) as unknown) as SettingsTableMutation;

      // First, try to find existing setting
      const { data: existing } = await settingsTable
        .select("id")
        .eq("key", dbKey)
        .eq("source", "platform")
        .maybeSingle();

      const existingSetting = existing;
      if (existingSetting && existingSetting.id) {
        // Update existing
        const updateData: SettingsUpdate = {
          value: settingValue,
          meta: {},
        };
        if (isActive !== undefined) updateData.is_active = isActive;
        const { error } = await settingsTable
          .update(updateData)
          .eq("id", existingSetting.id);

        if (error) throw error;
      } else {
        // Insert new
        const insertData: SettingsInsert = {
          key: dbKey,
          value: settingValue,
          source: "platform",
          is_active: isActive ?? true,
          meta: {},
        };
        const { error } = await settingsTable.insert(insertData);

        if (error) throw error;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
  });
};

export const useSavePlatformSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: PlatformSettings) => {
      // Convert settings to database format
      const settingsToSave = Object.entries(SETTING_KEYS).map(
        ([uiKey, dbKey]) => {
          const value = settings[uiKey as keyof PlatformSettings];
          return {
            key: dbKey,
            value: String(value),
            source: "platform",
            is_active: true,
            meta: {},
          };
        }
      );

      // Type-safe operations for settings table
      const settingsTable = (supabase.from("settings" as never) as unknown) as SettingsTableMutation;

      // For each setting, check if it exists and update, otherwise insert
      const savePromises = settingsToSave.map(async (setting) => {
        // First, try to find existing setting
        const { data: existing } = await settingsTable
          .select("id")
          .eq("key", setting.key)
          .eq("source", setting.source)
          .maybeSingle();

        const existingSetting = existing;
        if (existingSetting && existingSetting.id) {
          // Update existing
          const updateData: SettingsUpdate = {
            value: setting.value,
            is_active: setting.is_active,
            meta: setting.meta,
          };
          const { error } = await settingsTable
            .update(updateData)
            .eq("id", existingSetting.id);

          if (error) throw error;
        } else {
          // Insert new
          const insertData: SettingsInsert = {
            key: setting.key,
            value: setting.value,
            source: setting.source,
            is_active: setting.is_active,
            meta: setting.meta,
          };
          const { error } = await settingsTable.insert(insertData);

          if (error) throw error;
        }
      });

      await Promise.all(savePromises);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
  });
};
