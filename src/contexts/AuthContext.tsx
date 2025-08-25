import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  role: 'vendor' | 'admin' | null;
  kyc_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  sendOTP: (email: string, fullName: string, phoneNumber: string) => Promise<{ error: Error | null }>;
  verifyOTP: (email: string, otpCode: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return;
      }

      // Get KYC status
      const { data: kycData, error: kycError } = await supabase
        .from('kyc_applications')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      if (kycError && kycError.code !== 'PGRST116') {
        console.error('Error fetching KYC status:', kycError);
        return;
      }

      setUserProfile({
        id: userId,
        email: profile?.email || '',
        full_name: profile?.full_name || null,
        phone_number: profile?.phone_number || null,
        role: roleData?.role || null,
        kyc_status: kycData?.status || null,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile data after a short delay to allow triggers to complete
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 500);
        } else {
          setUserProfile(null);
        }
        
        setLoading(false);
      }
    );

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

  const signUp = async (email: string, password: string, fullName: string, phoneNumber: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
          },
        },
      });

      if (error) return { error };

      // If user is created but not confirmed, send OTP
      if (data.user && !data.user.email_confirmed_at) {
        const otpResult = await sendOTP(email, fullName, phoneNumber);
        if (otpResult.error) {
          console.error('Failed to send OTP:', otpResult.error);
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
      console.error('Error signing out:', error);
      toast.error('Error signing out');
    }
  };

  const sendOTP = async (email: string, fullName: string, phoneNumber: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp-email', {
        body: { email, fullName, phoneNumber },
      });

      if (error) {
        console.error('Error sending OTP:', error);
        return { error: new Error('Failed to send verification code') };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyOTP = async (email: string, otpCode: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { email, otpCode },
      });

      if (error) {
        console.error('Error verifying OTP:', error);
        return { error: new Error('Failed to verify code') };
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
    signUp,
    signIn,
    signOut,
    sendOTP,
    verifyOTP,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};