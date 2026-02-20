
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Menu, X, FileText, User, Calendar, Bell, ArrowRight } from "lucide-react";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useNotificationRealtime,
  type Notification,
  type NotificationType,
} from "@/hooks/useNotifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ShoppingCart,
  CreditCard,
  Banknote,
  UserPlus,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ---------------------------------------------------------------------------
// Notification helpers
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

// ---------------------------------------------------------------------------
// Bell + Popover component
// ---------------------------------------------------------------------------

function NotificationBell() {
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [open, setOpen] = useState(false);

  const recent = (notifications ?? []).slice(0, 5);
  const count = unreadCount ?? 0;

  const handleItemClick = (n: Notification) => {
    if (n.status !== "read") markRead.mutate(n.id);
    const bookingId = n.metadata?.booking_id as string | undefined;
    if (bookingId) navigate(`/vendor/bookings/${bookingId}`);
    setTimeout(() => setOpen(false), 0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-gray-100 transition-colors" aria-label="Notifications">
          <Bell className="h-5 w-5 text-gray-600" />
          {count > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          {count > 0 && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {count} unread
            </span>
          )}
        </div>

        {/* Notification list */}
        {recent.length > 0 ? (
          <div className="max-h-[320px] overflow-y-auto divide-y">
              {recent.map((n) => {
                const Icon = ICON_MAP[n.type] ?? Bell;
                const colorClass = COLOR_MAP[n.type] ?? "text-gray-600 bg-gray-50";
                const isUnread = n.status !== "read";

                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                      isUnread && "bg-blue-50/40"
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={cn("text-sm truncate", isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                          {n.title}
                        </p>
                        {isUnread && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 px-4 text-center">
            <Bell className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No notifications yet</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t">
          <Link
            to="/vendor/notifications"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-gray-50 transition-colors"
          >
            View all notifications
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const VendorLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userProfile, signOut } = useAuth();

  // Subscribe to real-time notification updates
  useNotificationRealtime();

  const navigation = [
    { name: 'Dashboard', href: '/vendor', icon: Calendar },
    { name: 'My Bookings', href: '/vendor/bookings', icon: FileText },
    { name: 'Profile', href: '/vendor/profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:z-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-4 md:justify-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              StallBook
            </h1>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  <span className="flex-1">{item.name}</span>
                </Link>
              );
            })}
          </nav>
          
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="flex items-center w-full">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {userProfile?.full_name || 'Vendor'}
                </p>
                <p className="text-xs text-gray-500">
                  {userProfile?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="ml-3 text-gray-500 hover:text-gray-700"
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar — always visible on desktop, doubles as mobile header */}
        <div className="flex h-16 items-center border-b border-gray-200 bg-white px-4">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="ml-4 flex-1 text-xl font-semibold text-gray-900 md:hidden">StallBook</h1>
          {/* Desktop spacer */}
          <div className="hidden md:block flex-1" />
          {/* Notification bell — always in top-right */}
          <NotificationBell />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
            <div className="h-full px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default VendorLayout;
