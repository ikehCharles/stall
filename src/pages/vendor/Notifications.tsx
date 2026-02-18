import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
  type NotificationType,
} from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  XCircle,
  CreditCard,
  Banknote,
  UserPlus,
  ClipboardCheck,
  ShoppingCart,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import CurrencyWrapper from "@/components/shared/currency";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ICON_MAP: Record<NotificationType, React.ElementType> = {
  booking_submitted: ShoppingCart,
  payment_received: CreditCard,
  offline_payment_complete: Banknote,
  vendor_onboarded: UserPlus,
  booking_approved: CheckCircle2,
  booking_rejected: XCircle,
  vendor_checked_in: ClipboardCheck,
};

const COLOR_MAP: Record<NotificationType, string> = {
  booking_submitted: "text-blue-600 bg-blue-50",
  payment_received: "text-emerald-600 bg-emerald-50",
  offline_payment_complete: "text-amber-600 bg-amber-50",
  vendor_onboarded: "text-purple-600 bg-purple-50",
  booking_approved: "text-green-600 bg-green-50",
  booking_rejected: "text-red-600 bg-red-50",
  vendor_checked_in: "text-sky-600 bg-sky-50",
};

function getNotificationLink(n: Notification): string | null {
  const bookingId = n.metadata?.booking_id as string | undefined;
  if (!bookingId) return null;

  switch (n.type) {
    case "booking_approved":
    case "booking_rejected":
    case "booking_submitted":
    case "payment_received":
    case "offline_payment_complete":
    case "vendor_checked_in":
      return `/vendor/bookings/${bookingId}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const navigate = useNavigate();
  const Icon = ICON_MAP[notification.type] ?? Bell;
  const colorClass = COLOR_MAP[notification.type] ?? "text-gray-600 bg-gray-50";
  const isUnread = notification.status !== "read";
  const link = getNotificationLink(notification);

  const handleClick = () => {
    if (isUnread) onRead(notification.id);
    if (link) navigate(link);
  };

  const amount = notification.metadata?.gross_amount ?? notification.metadata?.total_amount;

  return (
    <Card
      className={cn(
        "transition-all duration-200 cursor-pointer hover:shadow-md border-l-4",
        isUnread
          ? "border-l-blue-500 bg-blue-50/30"
          : "border-l-transparent bg-white"
      )}
      onClick={handleClick}
    >
      <CardContent className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full",
            colorClass
          )}
        >
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "text-sm truncate",
                isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"
              )}
            >
              {notification.title}
            </h3>
            {isUnread && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
            {notification.body}
          </p>

          {/* Meta pills */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {notification.metadata?.invoice_number && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {notification.metadata.invoice_number as string}
              </span>
            )}
            {notification.metadata?.market_name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {notification.metadata.market_name as string}
              </span>
            )}
            {amount != null && amount !== "—" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                <CurrencyWrapper amount={Number(amount)} />
              </span>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
          })}
        </span>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const Notifications = () => {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount =
    notifications?.filter((n) => n.status !== "read").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="gap-1.5"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={(id) => markRead.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            No notifications yet
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            When you receive booking updates, payment alerts, or check-in
            confirmations, they will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

export default Notifications;
