import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface KYCBannerProps {
  status: 'NOT_STARTED' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  className?: string;
}

export const KYCBanner = ({ status, className }: KYCBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  // Check if banner should be shown
  const shouldShow = status && ['NOT_STARTED', 'DRAFT', 'PENDING'].includes(status) && !dismissed;

  // Load dismissed state from localStorage on mount
  useEffect(() => {
    const dismissedUntil = localStorage.getItem('kyc-banner-dismissed');
    if (dismissedUntil) {
      const now = new Date().getTime();
      if (now < parseInt(dismissedUntil)) {
        setDismissed(true);
      } else {
        localStorage.removeItem('kyc-banner-dismissed');
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for the session (until next login/page refresh)
    const sessionEnd = new Date().getTime() + (24 * 60 * 60 * 1000); // 24 hours
    localStorage.setItem('kyc-banner-dismissed', sessionEnd.toString());
  };

  if (!shouldShow) return null;

  const getMessage = () => {
    switch (status) {
      case 'PENDING':
        return "Your business verification is under review. You'll be notified once approved.";
      case 'DRAFT':
        return "Complete your business verification to unlock bookings.";
      default:
        return "Complete your business verification to unlock bookings.";
    }
  };

  const getVariant = () => {
    return 'default' as const;
  };

  return (
    <Alert 
      className={cn(
        "mb-6 border-l-4 border-l-primary bg-primary/5",
        className
      )}
      variant={getVariant()}
      role="status"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full pr-2">
        <span className="flex-1">{getMessage()}</span>
        <div className="flex items-center gap-2">
          {status !== 'PENDING' && (
            <Button asChild size="sm" variant="default">
              <Link to="/vendor/kyc">Go to KYC</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-auto p-1 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};