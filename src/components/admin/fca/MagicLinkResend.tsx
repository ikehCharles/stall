import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MagicLinkResendProps {
  email: string;
  /** Auto-send the magic link on mount (e.g. right after user creation) */
  autoSend?: boolean;
  /** Cooldown duration in seconds between resends */
  cooldownSeconds?: number;
  /** Callback after a successful send */
  onSent?: () => void;
}

export const MagicLinkResend = ({
  email,
  autoSend = false,
  cooldownSeconds = 60,
  onSent,
}: MagicLinkResendProps) => {
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const sendMagicLink = useCallback(async () => {
    if (secondsLeft > 0 || isSending) return;

    setIsSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false, // user already exists via invite-user
        },
      });

      if (error) {
        toast({
          title: "Failed to send magic link",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setHasSent(true);
        setSecondsLeft(cooldownSeconds);
        onSent?.();
        toast({
          title: "Magic link sent!",
          description: `A sign-in link has been sent to ${email}`,
        });
      }
    } catch {
      toast({
        title: "Failed to send magic link",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }, [email, secondsLeft, isSending, cooldownSeconds, onSent]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // Auto-send on mount if requested
  useEffect(() => {
    if (autoSend) {
      sendMagicLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOnCooldown = secondsLeft > 0;

  return (
    <div className="space-y-3">
      {hasSent && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-800">
            Magic link sent to <span className="font-semibold">{email}</span>.
            The vendor should check their inbox to verify their account.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant={hasSent ? "outline" : "default"}
          size="sm"
          onClick={sendMagicLink}
          disabled={isSending || isOnCooldown}
          className="gap-2"
        >
          {isSending ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Mail className="h-3.5 w-3.5" />
              {hasSent ? "Resend Magic Link" : "Send Magic Link"}
            </>
          )}
        </Button>

        {isOnCooldown && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Resend available in {secondsLeft}s
          </span>
        )}
      </div>
    </div>
  );
};
