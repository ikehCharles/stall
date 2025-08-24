
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import VendorLayout from "./components/layouts/VendorLayout";
import AdminLayout from "./components/layouts/AdminLayout";
import VendorDashboard from "./pages/vendor/VendorDashboard";
import StallBooking from "./pages/vendor/StallBooking";
import MyBookings from "./pages/vendor/MyBookings";
import BookingDetails from "./pages/vendor/BookingDetails";
import InvoiceView from "./pages/vendor/InvoiceView";
import VendorProfile from "./pages/vendor/VendorProfile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StallConfiguration from "./pages/admin/StallConfiguration";
import AdminBookings from "./pages/admin/AdminBookings";
import Settings from "./pages/admin/Settings";
import { KYCPage } from "./pages/vendor/KYCPage";
import { KYCReview } from "./pages/admin/KYCReview";

const queryClient = new QueryClient();

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'vendor' | 'admin';
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const App = () => {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, password: string): boolean => {
    // Mock authentication
    if (email === "vendor@example.com" && password === "password") {
      setUser({
        id: "1",
        email: "vendor@example.com",
        name: "John Vendor",
        role: "vendor"
      });
      return true;
    } else if (email === "admin@example.com" && password === "password") {
      setUser({
        id: "2",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin"
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const authContext: AuthContextType = {
    user,
    login,
    logout
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <Routes>
              {/* Authentication Routes */}
              <Route path="/login" element={!user ? <Login authContext={authContext} /> : <Navigate to={user.role === 'admin' ? '/admin' : '/vendor'} />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              
              {/* Vendor Routes */}
              <Route path="/vendor" element={user?.role === 'vendor' ? <VendorLayout authContext={authContext} /> : <Navigate to="/login" />}>
                <Route index element={<VendorDashboard />} />
                <Route path="bookings" element={<MyBookings />} />
                <Route path="bookings/:id" element={<BookingDetails />} />
                <Route path="booking" element={<StallBooking />} />
                <Route path="kyc" element={<KYCPage />} />
                <Route path="profile" element={<VendorProfile />} />
                <Route path="invoice/:id" element={<InvoiceView />} />
              </Route>
              
              {/* Admin Routes */}
              <Route path="/admin" element={user?.role === 'admin' ? <AdminLayout authContext={authContext} /> : <Navigate to="/login" />}>
                <Route index element={<AdminDashboard />} />
                <Route path="stalls" element={<StallConfiguration />} />
                <Route path="bookings" element={<AdminBookings />} />
                <Route path="kyc" element={<KYCReview />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              
              {/* Default Routes */}
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
