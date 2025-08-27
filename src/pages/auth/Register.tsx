import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { EmailVerificationPending } from "@/components/auth/EmailVerificationPending";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { isValidPhoneNumber } from 'libphonenumber-js';

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{email?: string; phone?: string}>({});

  const { signUp, verifyOTP } = useAuth();
  const { startLoading, stopLoading } = useLoading();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number format
    if (!isValidPhoneNumber(phoneNumber)) {
      setError("Please enter a valid phone number");
      return;
    }
    
    setIsLoading(true);
    startLoading();
    setError("");
    setFieldErrors({});

    // Normalize inputs
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phoneNumber.trim();

    const { error } = await signUp(normalizedEmail, password, fullName, normalizedPhone);

    if (error) {
      // Handle unique constraint violations
      if (error.message.includes('profiles_email_unique') || error.message.includes('duplicate') && error.message.includes('email')) {
        setFieldErrors({ email: "This email is already registered." });
        setError("");
      } else if (error.message.includes('profiles_phone_number_unique') || error.message.includes('duplicate') && error.message.includes('phone')) {
        setFieldErrors({ phone: "This phone number is already registered." });
        setError("");
      } else {
        setError(error.message);
        toast.error("Registration failed: " + error.message);
      }
    } else {
      setNeedsVerification(true);
      const verificationMode = import.meta.env.AUTH_VERIFICATION_MODE || 'magic-link';
      if (verificationMode === 'magic-link') {
        toast.success("Registration successful! Please check your email for the verification link.");
      } else {
        toast.success("Registration successful! Please check your email for verification code.");
      }
    }

    setIsLoading(false);
    stopLoading();
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    startLoading();
    setError("");

    const { error } = await verifyOTP(email, otpCode);

    if (error) {
      setError(error.message);
      toast.error("Verification failed: " + error.message);
    } else {
      toast.success("Email verified successfully!");
      navigate("/vendor");
    }

    setIsLoading(false);
    stopLoading();
  };

  if (needsVerification) {
    const verificationMode = import.meta.env.AUTH_VERIFICATION_MODE || 'magic-link';
    
    if (verificationMode === 'magic-link') {
      return <EmailVerificationPending email={email} />;
    }

    // Fallback to OTP verification for backward compatibility
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Verify Your Email</CardTitle>
            <CardDescription className="text-center">
              We sent a verification code to {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otpCode">Verification Code</Label>
                <Input
                  id="otpCode"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Register as a vendor to start booking stalls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={fieldErrors.email ? "border-destructive" : ""}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">
                  {fieldErrors.email}{" "}
                  <Link to="/login" className="underline font-medium">
                    Log in instead
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className={fieldErrors.phone ? "border border-destructive rounded-md" : ""}>
                <PhoneInput
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(value) => setPhoneNumber(value)}
                  placeholder="Enter your phone number"
                  required
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-sm text-destructive">
                  {fieldErrors.phone}{" "}
                  <Link to="/login" className="underline font-medium">
                    Log in instead
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;