
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { EmailVerificationPending } from "@/components/auth/EmailVerificationPending";
import { Mail, Loader2 } from "lucide-react";
import { useAppBranding } from "@/hooks/useAppBranding";

const Login = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { appName, appInitial, appLogoUrl, appSlogan } = useAppBranding();

  const { signInWithMagicLink, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await signInWithMagicLink(normalizedEmail);

    if (error) {
      setError(error.message);
      toast.error("Failed to send sign-in link: " + error.message);
    } else {
      setMagicLinkSent(true);
      toast.success("Check your email for the sign-in link!");
    }

    setIsLoading(false);
  };

  // If already logged in, redirect
  useEffect(() => {
    if (userProfile) {
      const defaultPath = userProfile.role === "admin" ? "/admin" : "/vendor";
      navigate(defaultPath);
    }
  }, [userProfile, navigate]);

  if (magicLinkSent) {
    return <EmailVerificationPending email={email} onBack={() => setMagicLinkSent(false)} />;
  }

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
          {appLogoUrl ? (
            <img src={appLogoUrl} alt={appName} className="mx-auto mb-5 h-14 w-14 rounded-xl object-cover shadow-lg" />
          ) : (
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
              <span className="text-2xl font-bold text-white">{appInitial}</span>
            </div>
          )}

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {appName}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {appSlogan || "Please sign in or sign up below."}
            </p>
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              A magic link will be sent to your email to complete the sign-in
              process.
            </p>

            <Button
              type="submit"
              className="h-11 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-semibold transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Continue With Email
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            No account? One will be created for you automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
