import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import AuthCallback from "./pages/auth/AuthCallback";
import VendorLayout from "./components/layouts/VendorLayout";
import AdminLayout from "./components/layouts/AdminLayout";
import VendorDashboard from "./pages/vendor/VendorDashboard";
import StallBooking from "./pages/vendor/StallBooking";
import MarketSelection from "./pages/vendor/MarketSelection";
import MyBookings from "./pages/vendor/MyBookings";
import BookingDetails from "./pages/vendor/BookingDetails";
import InvoiceView from "./pages/vendor/InvoiceView";
import VendorProfile from "./pages/vendor/VendorProfile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import Settings from "./pages/admin/Settings";
import Markets from "./pages/admin/Markets";
import MarketCanvas from "./pages/admin/MarketCanvas";
import StallTemplates from "./pages/admin/StallTemplates";
import UserManagement from "./pages/admin/UserManagement";
import RoleManagement from "./pages/admin/RoleManagement";
import { KYCReview } from "./pages/admin/KYCReview";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoadingProvider, useLoading } from "./contexts/LoadingContext";
import { PageLoader } from "./components/ui/page-loader";
import { ProtectedRoute } from "./components/ProtectedRoute";
import BookingConfirmation from "./pages/vendor/BookingConfirmation";
import FCAMarketView from "./pages/admin/fca/FCAMarketView";
import FCAStallBooking from "./pages/admin/fca/FCAStallBooking";
import FCACheckout from "./pages/admin/fca/FCACheckout";
import FCAInvoiceView from "./pages/admin/fca/FCAInvoiceView";
import { PERMISSIONS } from "./lib/permissions";
import { AccessDenied } from "./pages/auth/unAuthorized";
import { PermissionGate } from "./components/PermissionGate";
import { usePermissions } from "./hooks/usePermissions";
import { RolesEnum } from "./lib/enums";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, userProfile, loading, profileLoading } = useAuth();
  const { isLoading } = useLoading();
  const { roleKey } = usePermissions();

  if (loading || profileLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user needs email verification
  const needsEmailVerification = user && !user.email_confirmed_at;

  // Check if user needs KYC (for redirects)
  const needsKYC =
    userProfile?.role === "vendor" && userProfile.kyc_status !== "APPROVED";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageLoader visible={isLoading} />
      <Routes>
        {/* Authentication Routes */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to={"/vendor"} />}
        />
        <Route
          path="/register"
          element={!user ? <Register /> : <Navigate to={"/vendor"} />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/unauthorized" element={<AccessDenied showSignOut />} />

        {/* Vendor Routes */}
        <Route
          path="/vendor"
          element={
            <ProtectedRoute
              requireAll
              requiredPermissions={[PERMISSIONS.VENDORS.VIEW_SELF]}
            >
              <VendorLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              needsKYC ? (
                <Navigate to="/vendor/profile?tab=verification" />
              ) : (
                <VendorDashboard />
              )
            }
          />
          <Route
            path="bookings"
            element={
              needsKYC ? (
                <Navigate to="/vendor/profile?tab=verification" />
              ) : (
                <MyBookings />
              )
            }
          />
          <Route path="bookings/:id" element={<BookingDetails />} />
          <Route
            path="bookings/:id/confirmation"
            element={
              needsKYC ? (
                <Navigate to="/vendor/profile?tab=verification" />
              ) : (
                <PermissionGate
                  fallback={<AccessDenied />}
                  permissions={[PERMISSIONS.VENDORS.VIEW_SELF]}
                >
                  <BookingConfirmation />
                </PermissionGate>
              )
            }
          />
          <Route
            path="markets"
            element={
              needsKYC ? (
                <Navigate to="/vendor/profile?tab=verification" />
              ) : (
                <PermissionGate
                  fallback={<AccessDenied />}
                  permissions={[PERMISSIONS.VENDORS.VIEW_SELF]}
                >
                  <MarketSelection />
                </PermissionGate>
              )
            }
          />
          <Route
            path="book-stall/:marketId"
            element={
              needsKYC ? (
                <Navigate to="/vendor/profile?tab=verification" />
              ) : (
                <PermissionGate
                  fallback={<AccessDenied />}
                  permissions={[PERMISSIONS.VENDORS.VIEW_SELF]}
                >
                  <StallBooking />
                </PermissionGate>
              )
            }
          />
          <Route path="profile" element={<VendorProfile />} />
          <Route
            path="invoice/:id"
            element={
              needsKYC ? (
                <Navigate to="/vendor/profile?tab=verification" />
              ) : (
                <PermissionGate
                  fallback={<AccessDenied />}
                  permissions={[PERMISSIONS.VENDORS.VIEW_SELF]}
                >
                  <InvoiceView />
                </PermissionGate>
              )
            }
          />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              fallbackPath="/unauthorized"
              requireAll
              requiredPermissions={[PERMISSIONS.USERS.VIEW_SELF]}
            >
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route
            path="markets"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.MARKETS)}
              >
                <Markets />
              </PermissionGate>
            }
          />
          <Route
            path="markets/:marketId/canvas"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.MARKETS)}
              >
                <MarketCanvas />
              </PermissionGate>
            }
          />
          <Route
            path="templates"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.STALLS)}
              >
                <StallTemplates />
              </PermissionGate>
            }
          />
          <Route
            path="bookings"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.BOOKINGS)}
              >
                <AdminBookings />
              </PermissionGate>
            }
          />
          <Route
            path="bookings/:id"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.BOOKINGS)}
              >
                <BookingDetails />
              </PermissionGate>
            }
          />
          <Route
            path="kyc"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.KYC)}
              >
                <KYCReview />
              </PermissionGate>
            }
          />
          <Route
            path="users"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.USERS)}
              >
                <UserManagement />
              </PermissionGate>
            }
          />
          <Route
            path="roles"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={Object.values(PERMISSIONS.ROLES)}
              >
                <RoleManagement />
              </PermissionGate>
            }
          />
          <Route
            path="settings"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={[PERMISSIONS.USERS.VIEW_SELF]}
              >
                <Settings />
              </PermissionGate>
            }
          />

          {/* FCA Routes */}
          <Route
            path="fca/markets"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={[PERMISSIONS.USERS.VIEW_SELF]}
              >
                <FCAMarketView />
              </PermissionGate>
            }
          />
          <Route
            path="fca/markets/:marketId"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={[PERMISSIONS.USERS.VIEW_SELF]}
              >
                <FCAStallBooking />
              </PermissionGate>
            }
          />
          <Route
            path="fca/checkout"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={[PERMISSIONS.USERS.VIEW_SELF]}
              >
                <FCACheckout />
              </PermissionGate>
            }
          />
          <Route
            path="fca/invoices/:id"
            element={
              <PermissionGate
                fallback={<AccessDenied />}
                permissions={[PERMISSIONS.USERS.VIEW_SELF]}
              >
                <FCAInvoiceView />
              </PermissionGate>
            }
          />
        </Route>

        {/* Default Routes */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LoadingProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </LoadingProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
