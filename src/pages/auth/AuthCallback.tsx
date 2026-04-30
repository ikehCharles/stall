import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Determines where to route a user after magic-link authentication:
 *  1. New user / incomplete profile → /vendor/profile
 *  2. Complete profile, no KYC approved → /vendor/profile?tab=verification
 *  3. Complete profile + KYC approved → /vendor (dashboard)
 *  4. Admin role → /admin
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Verifying your account...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 1. Confirm we have a valid session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
          toast.error("Authentication failed. Please try again.");
          navigate("/login");
          return;
        }

        const userId = sessionData.session.user.id;
        setStatusMessage("Loading your profile...");

        // 2. Fetch profile, role, and KYC status in parallel
        const [profileResult, roleResult, kycResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, phone_number, address, last_login_at")
            .eq("id", userId)
            .maybeSingle(),
          supabase.rpc("get_user_role_key", { user_uuid: userId }),
          supabase
            .from("kyc_applications")
            .select("status")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const profile = profileResult.data;
        const roleKey = roleResult.data;
        const kycStatus = kycResult.data?.status;
        const isFirstLogin = !profile?.last_login_at;

        // Stamp last_login_at (fire-and-forget)
        supabase
          .from("profiles")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", userId)
          .then();

        // 3. Admin users always go to admin dashboard
        if (roleKey === "admin") {
          toast.success("Welcome back!");
          navigate("/admin");
          return;
        }

        // 4. Check profile completeness (full_name and phone_number are required)
        const isProfileComplete =
          !!profile?.full_name?.trim() && !!profile?.phone_number?.trim();

        if (!isProfileComplete) {
          // Scenario 1 & 2: New user or incomplete profile
          toast.info(isFirstLogin
            ? "Welcome! Please complete your profile to get started."
            : "Please complete your profile to continue.");
          navigate("/vendor/profile");
          return;
        }

        // 5. Profile is complete — check KYC
        if (kycStatus !== "APPROVED") {
          // Scenario 3: Complete profile but KYC not approved
          toast.info("Please complete your business verification.");
          navigate("/vendor/profile?tab=verification");
          return;
        }

        // 6. Scenario 4: Everything done — go to dashboard
        toast.success("Welcome back!");
        navigate("/vendor");
      } catch (error) {
        toast.error("Something went wrong. Please try again.");
        navigate("/login");
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-slate-600">{statusMessage}</p>
      </div>
    </div>
  );
};

export default AuthCallback;