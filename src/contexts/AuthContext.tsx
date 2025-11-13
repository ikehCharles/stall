import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useNavigate } from "react-router-dom";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  company_name: string | null;
  address: string | null;
  business_logo_url: string | null;
  // RBAC fields
  role_key: string | null; // 'admin', 'vendor', 'fca'
  role_name: string | null; // 'Administrator', 'Vendor', 'Field Collections Agent'
  permissions: string[]; // ['markets.view', 'stalls.book.self', ...]
  // Legacy role field for backward compatibility
  role: "vendor" | "admin" | null;
  kyc_status: "PENDING" | "APPROVED" | "REJECTED" | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber: string
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  sendOTP: (
    email: string,
    fullName: string,
    phoneNumber: string
  ) => Promise<{ error: Error | null }>;
  verifyOTP: (
    email: string,
    otpCode: string
  ) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserProfile = async (userId: string) => {
    
    setProfileLoading(true);
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setProfileLoading(false);
        return;
      }

      // Get user role with permissions using RPC function
      const { data: roleData, error: roleError } = await supabase.rpc(
        "get_user_role_with_permissions",
        { user_uuid: userId }
      );

      if (roleError) {
        console.error("Error fetching role and permissions:", roleError);
        setProfileLoading(false);
        return;
      }

      // RPC returns a single row, extract the first element if it's an array
      const roleInfo = Array.isArray(roleData) ? roleData[0] : roleData;

      // Get KYC status
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_applications")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();

      if (kycError && kycError.code !== "PGRST116") {
        console.error("Error fetching KYC status:", kycError);
      }

      setUserProfile({
        id: userId,
        email: profile?.email || "",
        full_name: profile?.full_name || null,
        phone_number: profile?.phone_number || null,
        company_name: profile?.company_name || null,
        address: profile?.address || null,
        business_logo_url: profile?.business_logo_url || null,
        // RBAC fields
        role_key: roleInfo?.role_key || null,
        role_name: roleInfo?.role_name || null,
        permissions: roleInfo?.permissions || [],
        // Legacy role field for backward compatibility
        role:
          roleInfo?.role_key === "admin"
            ? "admin"
            : roleInfo?.role_key === "vendor"
            ? "vendor"
            : null,
        kyc_status: kycData?.status || null,
      });
      setProfileLoading(false);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch user profile data with minimal delay to allow triggers to complete
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 100);
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }

      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserProfile(session.user.id);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phoneNumber: string
  ) => {
    try {
      // Check verification mode from environment
      const verificationMode =
        import.meta.env.AUTH_VERIFICATION_MODE || "magic-link";

      // Ensure phone number is in E.164 format
      let formattedPhone = phoneNumber;
      if (phoneNumber && !phoneNumber.startsWith("+")) {
        // If no country code, assume UK (+44) for backwards compatibility
        formattedPhone = `+44${phoneNumber.replace(/\D/g, "").slice(-10)}`;
      }

      // Validate the formatted phone number
      if (!isValidPhoneNumber(formattedPhone)) {
        return { error: new Error("Invalid phone number format") };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            phone_number: formattedPhone,
          },
        },
      });

      if (error) return { error };

      // For backward compatibility with OTP mode
      if (
        verificationMode === "otp" &&
        data.user &&
        !data.user.email_confirmed_at
      ) {
        const otpResult = await sendOTP(email, fullName, formattedPhone);
        if (otpResult.error) {
          console.error("Failed to send OTP:", otpResult.error);
          // Don't return error here as signup was successful
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      toast.error("Error signing out");
    }
    // invalid session or cleared out session
    localStorage.clear();
    navigate("/login");
  };

  const sendOTP = async (
    email: string,
    fullName: string,
    phoneNumber: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-otp-email",
        {
          body: { email, fullName, phoneNumber },
        }
      );

      if (error) {
        console.error("Error sending OTP:", error);
        return { error: new Error("Failed to send verification code") };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyOTP = async (email: string, otpCode: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email, otpCode },
      });

      if (error) {
        console.error("Error verifying OTP:", error);
        return { error: new Error("Failed to verify code") };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      // Refresh the session to get updated user data
      await supabase.auth.refreshSession();

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    loading,
    profileLoading,
    signUp,
    signIn,
    signOut,
    sendOTP,
    verifyOTP,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
