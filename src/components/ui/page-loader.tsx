import { cn } from "@/lib/utils";

interface PageLoaderProps {
  visible: boolean;
  className?: string;
}

export const PageLoader = ({ visible, className }: PageLoaderProps) => {
  if (!visible) return null;

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-1 bg-muted overflow-hidden",
        className
      )}
      role="progressbar" 
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="h-full bg-primary animate-pulse relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent animate-slide-right" />
      </div>
    </div>
  );
};