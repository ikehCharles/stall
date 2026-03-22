
import { Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Menu, X, BarChart3, Map, FileText, Settings, ShieldCheck, Square, Briefcase, Users, Shield, ClipboardList } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { usePlatformSettings } from "@/hooks/useSettings";
import { APP_NAME_DEFAULT, appInitial } from "@/lib/appBranding";

const AdminLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userProfile, signOut } = useAuth();
  const { data: platformSettings } = usePlatformSettings();
  const appName = platformSettings?.appName || APP_NAME_DEFAULT;
  const appLogoUrl = platformSettings?.appLogoUrl || "";
  const isFCAMode = location.pathname.startsWith('/admin/fca');
  const isCanvasMode = /\/admin\/markets\/[^/]+\/canvas/.test(location.pathname);

  // Toggle fca-dark on <html> so portaled Dialog/Sheet components also inherit the theme
  useEffect(() => {
    const root = document.documentElement;
    if (isFCAMode) {
      root.classList.add('fca-dark');
    } else {
      root.classList.remove('fca-dark');
    }
    return () => root.classList.remove('fca-dark');
  }, [isFCAMode]);
  // Sidebar is collapsible on mobile & tablet (< lg), static on lg+


  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/admin', 
      icon: BarChart3,
      permissions: [] // No special permissions needed for dashboard
    },
    { 
      name: 'Markets', 
      href: '/admin/markets', 
      icon: Map,
      permissions: [PERMISSIONS.MARKETS.MANAGE, PERMISSIONS.MARKETS.VIEW]
    },
    { 
      name: 'Templates', 
      href: '/admin/templates', 
      icon: Square,
      permissions: [PERMISSIONS.STALLS.MANAGE, PERMISSIONS.NOTIFICATIONS.MANAGE]
    },
    { 
      name: 'All Bookings', 
      href: '/admin/bookings', 
      icon: FileText,
      permissions: [PERMISSIONS.BOOKINGS.VIEW_ALL, PERMISSIONS.BOOKINGS.MANAGE, PERMISSIONS.BOOKINGS.CREATE_ANY]
    },
    { 
      name: 'KYC Review', 
      href: '/admin/kyc', 
      icon: ShieldCheck,
      permissions: [PERMISSIONS.KYC.REVIEW, PERMISSIONS.KYC.VIEW_ALL]
    },
    { 
      name: 'Users', 
      href: '/admin/users', 
      icon: Users,
      permissions: [PERMISSIONS.USERS.VIEW, PERMISSIONS.USERS.MANAGE, PERMISSIONS.USERS.INVITE]
    },
    { 
      name: 'Roles', 
      href: '/admin/roles', 
      icon: Shield,
      permissions: [PERMISSIONS.ROLES.VIEW, PERMISSIONS.ROLES.CREATE, PERMISSIONS.ROLES.MANAGE]
    },
    { 
      name: 'Reporting', 
      href: '/admin/reports', 
      icon: ClipboardList,
      permissions: [PERMISSIONS.VAT.VIEW, PERMISSIONS.VAT.MANAGE, PERMISSIONS.AUDIT_LOG.VIEW]
    },
    { 
      name: 'FCA Mode', 
      href: '/admin/fca/markets', 
      icon: Briefcase,
      permissions: [PERMISSIONS.VENDORS.LOOKUP, PERMISSIONS.PAYMENTS.COLLECT]
    },
    { 
      name: 'Settings', 
      href: '/admin/settings', 
      icon: Settings,
      permissions: [] // Available to all admins
    },
  ];

  return (
    <div className={cn("flex h-screen", isFCAMode ? "fca-dark bg-background text-foreground" : "bg-gray-50")}>
      {/* Only show sidebar if NOT in FCA mode */}
      {!isFCAMode && (
        <>
          {/* Sidebar overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center justify-between px-4 lg:justify-center">
                <div className="flex justify-between w-full items-center gap-2.5">
                  {appLogoUrl ? (
                    <img src={appLogoUrl} alt={appName} className="h-10 w-10 rounded-xl object-cover shadow-md" />
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                      <span className="text-lg font-bold text-white">{appInitial(appName)}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
              
              <nav className="flex-1 space-y-1 px-2 py-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname === item.href || location.pathname.startsWith(item.href + "/");
                  
                  return (
                    <PermissionGate key={item.name} permissions={item.permissions}>
                      <Link
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
                        {item.name}
                      </Link>
                    </PermissionGate>
                  );
                })}
              </nav>
              
              <div className="flex-shrink-0 border-t border-gray-200 p-4">
                <div className="flex items-center w-full">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile?.full_name || 'Admin'}
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
        </>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Only show mobile header if NOT in FCA mode */}
        {!isFCAMode && (
          <div className="flex justify-between h-16 items-center border-b border-gray-200 bg-white px-4 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="ml-4 flex justify-between items-center gap-2">
              {appLogoUrl ? (
                <img src={appLogoUrl} alt={appName} className="h-8 w-8 rounded-lg object-cover shadow-sm" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-sm">
                  <span className="text-sm font-bold text-white">{appInitial(appName)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
            <div className={cn("h-full", isCanvasMode ? "" : "px-4 py-6 sm:px-6 lg:px-8")}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
