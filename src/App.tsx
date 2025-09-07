
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
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
import { KYCPage } from "./pages/vendor/KYCPage";
import { KYCReview } from "./pages/admin/KYCReview";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoadingProvider, useLoading } from "./contexts/LoadingContext";
import { PageLoader } from "./components/ui/page-loader";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, userProfile, loading, profileLoading } = useAuth();
  const { isLoading } = useLoading();

  if (loading || (user && profileLoading)) {
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
  
  // Check if user needs KYC
  const needsKYC = userProfile?.role === 'vendor' && 
    (!userProfile.kyc_status || userProfile.kyc_status === 'PENDING');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageLoader visible={isLoading} />
      <Routes>
        {/* Authentication Routes */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to={userProfile?.role === 'admin' ? '/admin' : '/vendor'} />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to={userProfile?.role === 'admin' ? '/admin' : '/vendor'} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Vendor Routes */}
        <Route path="/vendor" element={
          user && userProfile?.role === 'vendor' ? 
            <VendorLayout /> : 
            <Navigate to="/login?next=/vendor" />
        }>
          <Route index element={needsKYC ? <Navigate to="/vendor/kyc" /> : <VendorDashboard />} />
          <Route path="bookings" element={needsKYC ? <Navigate to="/vendor/kyc" /> : <MyBookings />} />
          <Route path="bookings/:id" element={needsKYC ? <Navigate to="/vendor/kyc" /> : <BookingDetails />} />
          <Route path="markets" element={needsKYC ? <Navigate to="/vendor/kyc" /> : <MarketSelection />} />
          <Route path="book-stall/:marketId" element={needsKYC ? <Navigate to="/vendor/kyc" /> : <StallBooking />} />
          <Route path="kyc" element={<KYCPage />} />
          <Route path="profile" element={<VendorProfile />} />
          <Route path="invoice/:id" element={needsKYC ? <Navigate to="/vendor/kyc" /> : <InvoiceView />} />
        </Route>
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          user && userProfile?.role === 'admin' ? 
            <AdminLayout /> : 
            <Navigate to="/login?next=/admin" />
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="markets" element={<Markets />} />
          <Route path="markets/:marketId/canvas" element={<MarketCanvas />} />
          <Route path="templates" element={<StallTemplates />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="kyc" element={<KYCReview />} />
          <Route path="settings" element={<Settings />} />
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
