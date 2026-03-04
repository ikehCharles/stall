import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, RefreshCw, ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We've sent a sign-in link to <span className="font-semibold">{email}</span>. Click the link in the email to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-sm text-muted-foreground">
              The link will expire in 1 hour. If you don't see the email, check your spam folder.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleResendEmail} 
            variant="outline" 
            className="w-full"
            disabled={isResending}
          >
            {isResending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Resend sign-in link
              </>
            )}
          </Button>

          {resendCount > 0 && (
            <Alert>
              <AlertDescription className="text-sm text-green-600">
                Email sent {resendCount} time{resendCount > 1 ? 's' : ''}. Please check your inbox.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};