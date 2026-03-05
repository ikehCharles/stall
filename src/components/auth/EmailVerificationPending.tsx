import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface EmailVerificationPendingProps {
  email: string;
}

export const EmailVerificationPending = ({ email }: EmailVerificationPendingProps) => {
  const [isResending, setIsResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      });

      if (error) {
        toast.error("Failed to resend email: " + error.message);
      } else {
        toast.success("Sign-in link sent!");
        setResendCount(prev => prev + 1);
      }
    } catch (error) {
      toast.error("Failed to resend email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/3 h-[420px] w-[420px] rounded-full bg-blue-400/15 blur-[120px] animate-pulse" />
        <div className="absolute -right-32 top-1/4 h-[380px] w-[380px] rounded-full bg-purple-400/15 blur-[120px] animate-pulse [animation-delay:1s]" />
        <div className="absolute left-1/4 -bottom-20 h-[300px] w-[300px] rounded-full bg-indigo-400/10 blur-[100px] animate-pulse [animation-delay:2s]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-8 shadow-xl backdrop-blur-xl">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
            <Mail className="h-7 w-7 text-white" />
          </div>

          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We've sent a sign-in link to{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              Click the link in the email to continue.
            </p>
          </div>

          {/* Info alert */}
          <Alert className="mb-5">
            <AlertDescription className="text-xs text-muted-foreground">
              The link will expire in 1 hour. If you don't see the email, check
              your spam folder.
            </AlertDescription>
          </Alert>

          {/* Resend button */}
          <Button
            onClick={handleResendEmail}
            variant="outline"
            className="h-11 w-full font-medium transition-all duration-200"
            disabled={isResending}
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend sign-in link
              </>
            )}
          </Button>

          {resendCount > 0 && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-xs text-green-700">
                Email sent {resendCount} time{resendCount > 1 ? "s" : ""}. Please check your inbox.
              </p>
            </div>
          )}

          {/* Back link */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};