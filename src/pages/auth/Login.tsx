
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { EmailVerificationPending } from "@/components/auth/EmailVerificationPending";
import { Mail } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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
      const defaultPath = userProfile.role === 'admin' ? '/admin' : '/vendor';
      navigate(defaultPath);
    }
  }, [userProfile, navigate]);

  if (magicLinkSent) {
    return <EmailVerificationPending email={email} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            StallBook
          </h1>
          <p className="text-gray-600 mt-2">Your marketplace management platform</p>
        </div>
        
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a magic link to sign in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="transition-all duration-200 focus:scale-[1.02]"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-[1.02]"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Sending link..."
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Magic Link
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
