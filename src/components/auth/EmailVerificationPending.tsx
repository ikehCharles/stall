import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailVerificationPendingProps {
  email: string;
}

export const EmailVerificationPending = ({ email }: EmailVerificationPendingProps) => {
  const [isResending, setIsResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        toast.error("Failed to resend email: " + error.message);
      } else {
        toast.success("Verification email sent!");
        setResendCount(prev => prev + 1);
      }
    } catch (error) {
      toast.error("Failed to resend email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email to verify your account</CardTitle>
          <CardDescription>
            We've sent a sign-in link to <span className="font-semibold">{email}</span>. Click the link to continue.
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
                Resend verification email
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

          <div className="text-center text-sm text-muted-foreground">
            Need help? Contact support if you continue having issues.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};