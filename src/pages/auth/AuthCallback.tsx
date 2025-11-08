import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast.error("Authentication failed: " + error.message);
          navigate("/login");
          return;
        }

        if (data.session) {
          toast.success("Email verified successfully!");
          
          // Refresh profile to get latest data
          await refreshProfile();
          
          // Wait a bit for profile to load then redirect based on role
          setTimeout(async () => {
            const { data: roleData } = await supabase
              .rpc('get_user_role_key', { user_uuid: data.session.user.id });
            
            if (roleData === 'admin') {
              navigate("/admin/dashboard");
            } else {
              navigate("/vendor/dashboard");
            }
          }, 100);
        } else {
          // No session found, redirect to login
          navigate("/login");
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error("Authentication failed");
        navigate("/login");
      }
    };

    handleAuthCallback();
  }, [navigate, refreshProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-slate-600">Verifying your account...</p>
      </div>
    </div>
  );
};

export default AuthCallback;