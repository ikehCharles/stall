
import { Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Menu, X, BarChart3, Map, FileText, Settings, ShieldCheck, Square, Briefcase, Users, Shield } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";

const AdminLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userProfile, signOut } = useAuth();
  const isFCAMode = location.pathname.startsWith('/admin/fca');

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
      permissions: [PERMISSIONS.MARKETS.MANAGE]
    },
    { 
      name: 'Templates', 
      href: '/admin/templates', 
      icon: Square,
      permissions: [PERMISSIONS.STALLS.MANAGE]
    },
    { 
      name: 'All Bookings', 
      href: '/admin/bookings', 
      icon: FileText,
      permissions: [PERMISSIONS.BOOKINGS.VIEW_ALL, PERMISSIONS.BOOKINGS.MANAGE]
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
      permissions: [PERMISSIONS.USERS.VIEW]
    },
    { 
      name: 'Roles', 
      href: '/admin/roles', 
      icon: Shield,
      permissions: [PERMISSIONS.ROLES.VIEW]
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
    <div className="flex h-screen bg-gray-50">
      {/* Only show sidebar if NOT in FCA mode */}
      {!isFCAMode && (
        <>
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
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    StallBook
                  </h1>
                  <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">Admin</span>
                </div>
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
          <div className="flex h-16 items-center border-b border-gray-200 bg-white px-4 md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="ml-4 text-xl font-semibold text-gray-900">StallBook Admin</h1>
          </div>
        )}

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

export default AdminLayout;
