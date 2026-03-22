import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUsers";
import { useQueryClient } from "@tanstack/react-query";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  company_name: string | null;
  address: string | null;
  business_logo_url: string | null;
  role_key: string | null;
  role_name: string | null;
  permissions: string[];
  role: string;
  kyc_status: "PENDING" | "APPROVED" | "REJECTED" | null;
  terms_accepted_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  sendOTP: (email: string, fullName: string, phoneNumber: string) => Promise<{ error: Error | null }>;
  verifyOTP: (email: string, otpCode: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: userProfile, isLoading:profileLoading, error } = useUserProfile(user?.id);
  // const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const refreshProfile = useCallback(async () => {
    queryClient.invalidateQueries({queryKey: ["user-profile", user?.id]})
  }, [queryClient, user?.id]);

  const signUp = useCallback(async (email: string, password: string, fullName: string, phoneNumber: string) => {
    try {
      let formattedPhone = phoneNumber;
      if (phoneNumber && !phoneNumber.startsWith("+")) {
        formattedPhone = `+44${phoneNumber.replace(/\D/g, "").slice(-10)}`;
      }
      if (!isValidPhoneNumber(formattedPhone)) return { error: new Error("Invalid phone number format") };

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: fullName, phone_number: formattedPhone },
        },
      });

      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      const next = searchParams.get("next");
      if (next) navigate(next.startsWith("/") ? next : "/dashboard");
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, [navigate, searchParams]);

  const signInWithMagicLink = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      });
      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
    localStorage.clear();
    navigate("/login");
  }, [navigate]);

  const sendOTP = useCallback(async (email: string, fullName: string, phoneNumber: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-otp-email", { body: { email, fullName, phoneNumber } });
      if (error) return { error: new Error("Failed to send verification code") };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const verifyOTP = useCallback(async (email: string, otpCode: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", { body: { email, otpCode } });
      if (error) return { error: new Error("Failed to verify code") };
      if (data?.error) return { error: new Error(data.error) };
      await supabase.auth.refreshSession();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // Auth state listener — rely on onAuthStateChange for all session updates.
  // INITIAL_SESSION fires automatically on mount (Supabase JS v2.39+),
  // so a separate getSession() call is not needed and avoids race conditions.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );


    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    userProfile,
    loading,
    profileLoading,
    signUp,
    signIn,
    signInWithMagicLink,
    signOut,
    sendOTP,
    verifyOTP,
    refreshProfile,
  }), [user, session, userProfile, loading, profileLoading, signUp, signIn, signInWithMagicLink, signOut, sendOTP, verifyOTP, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
