import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface StallHoldTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

export function StallHoldTimer({ expiresAt, onExpired }: StallHoldTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      return Math.max(0, diff);
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (timeLeft <= 0) {
    return (
      <Badge variant="destructive" className="animate-pulse">
        <Clock className="w-3 h-3 mr-1" />
        Expired
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
      <Clock className="w-3 h-3 mr-1" />
      Hold expires in {formatTime(timeLeft)}
    </Badge>
  );
}