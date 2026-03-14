import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | "booking_submitted"
  | "payment_received"
  | "offline_payment_complete"
  | "vendor_onboarded"
  | "booking_approved"
  | "booking_rejected"
  | "vendor_checked_in"
  | "refund_requested"
  | "refund_resolved"
  | "kyc_submitted";

export type NotificationStatus = "pending" | "sent" | "failed" | "read";

export interface Notification {
  id: string;
  recipient_id: string;
  recipient_email: string;
  type: NotificationType;
  channel: string;
  status: NotificationStatus;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  idempotency_key: string;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
  error_message: string | null;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const NOTIFICATIONS_KEY = ["notifications"];
const UNREAD_COUNT_KEY = ["notifications", "unread-count"];

// ---------------------------------------------------------------------------
// Untyped client helper
// ---------------------------------------------------------------------------
// The "notifications" table and its RPC functions are not yet in the
// auto-generated Database type, so going through the typed client triggers
// "Type instantiation is excessively deep and possibly infinite."
// We cast once here and keep every consumer fully typed via `Notification`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string) => (supabase as any).from(table);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, params?: Record<string, unknown>) => (supabase as any).rpc(fn, params);

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all notifications for the current user (ordered by newest first) */
export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const { data, error } = await from("notifications")
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    enabled: !!user,
  });
}

/** Fetch unread notification count for the current user */
export function useUnreadNotificationCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async () => {
      const { count, error } = await from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .neq("status", "read");

      if (error) throw error;
      return (count ?? 0) as number;
    },
    enabled: !!user,
  });
}

/** Mark a single notification as read */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await rpc("mark_notification_read", {
        p_notification_id: notificationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

/** Mark all notifications as read for the current user */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await rpc("mark_all_notifications_read");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

/**
 * Subscribe to real-time notification changes for the current user.
 * Automatically invalidates queries when a new notification arrives.
 * Call this once at a high-level layout component.
 */
export function useNotificationRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          // Invalidate queries to refresh UI
          queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
          queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });

          // Show a toast for the new notification
          const record = payload.new as Notification;
          toast({
            title: record.title,
            description: record.body.length > 100
              ? record.body.substring(0, 100) + "…"
              : record.body,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, toast]);
}

/**
 * Trigger the send-notification edge function to process pending emails.
 * Useful for testing or manual dispatch.
 */
export function useSendPendingNotifications() {
  return useMutation({
    mutationFn: async (notificationId?: string) => {
      const { data, error } = await supabase.functions.invoke(
        "send-notification",
        {
          body: notificationId
            ? { notification_id: notificationId }
            : { process_pending: 50 },
        }
      );
      if (error) throw error;
      return data;
    },
  });
}
