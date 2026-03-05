import {
  AlertCircle,
  User,
  Mail,
  Phone,
  Building,
  IdCard,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MagicLinkResend } from "./MagicLinkResend";
import { useState } from "react";
import { UseMutationResult } from "@tanstack/react-query";
import { Profile, UserBookingsResponse } from "@/hooks/useVendorLookup";
import { PostgrestError } from "@supabase/supabase-js";
import { Market } from "@/hooks/useMarkets";
import { Link } from "react-router-dom";
import { getKycBadge } from "@/components/shared/statuses";

interface VendorCheckinBookingProps {
  vendorLookup: UseMutationResult<
    UserBookingsResponse,
    PostgrestError,
    { email: string; marketId: string },
    unknown
  >;
  email: string;
  market: Market;
  onViewBookings: () => void;
}

const VendorCheckinBooking: React.FC<VendorCheckinBookingProps> = ({
  vendorLookup,
  email,
  market,
  onViewBookings,
}) => {
  const { error, data, isError, isSuccess } = vendorLookup;
  const profile = data?.profile;
  const hasBookings = data?.bookings?.length > 0;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshLookup = async () => {
    setIsRefreshing(true);
    try {
      await vendorLookup.mutateAsync({ email, marketId: market.id });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper: KYC Badge
  const KycBadge = () => {
    if (!profile?.kyc_status)
      return <Badge variant="destructive">KYC Pending</Badge>;
    if (profile.kyc_status === "APPROVED")
      return (
        <Badge className="bg-green-100 text-green-800">KYC Approved</Badge>
      );
    if (profile.kyc_status === "PENDING")
      return (
        <Badge className="bg-yellow-100 text-yellow-800">KYC Pending</Badge>
      );
    return <Badge variant="secondary">{profile.kyc_status}</Badge>;
  };

  return (
    <>

      {/* Case 0: User found but not a vendor */}
      {isError && error?.code === "P4031" && (
        <Card className="border-amber-400 bg-amber-50">
          <CardContent className="pt-8 pb-10">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-3">
                <ShieldAlert className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <p className="font-medium text-amber-900">
                  This user is not a vendor
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">{email}</span> exists but does not have the vendor role.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case 1: No user found → Create user & send magic link */}
      {isError && error?.code === "P4040" && (
        <Card className="border-destructive/70 bg-destructive/5">
          <CardContent className="pt-8 pb-10">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">
                No user found for email
              </p>
              <p className="text-sm text-muted-foreground mt-1">{email}</p>
            </div>
          </div>
        
              </div>

              {/* Magic link with shouldCreateUser=true to create user on first send */}
              <div className="border-t border-destructive/20 pt-4">
          <MagicLinkResend
            email={email}
            shouldCreateUser={true}
            cooldownSeconds={60}
            successMessage={`A magic link has been sent to ${email}. Kindly inform the vendor to verify by signing in for the first time.`}
          />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case 2: Vendor found but has not signed in yet */}
      {isSuccess && profile && !profile.last_login_at && (
        <Card className="border-2 border-amber-400 bg-amber-50/80 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2.5 sm:p-3 flex-shrink-0">
                  <ShieldAlert className="h-6 w-6 sm:h-7 sm:w-7 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900 leading-tight">
                    Pending Verification
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-700">
                    {profile.full_name || "Vendor"} has not signed in yet
                  </p>
                </div>
              </div>

              <Badge className="bg-amber-100 text-amber-800 border-amber-300 w-fit">
                Not Verified
              </Badge>
            </div>

            {/* Vendor Info */}
            <div className="space-y-3 text-sm bg-white/80 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="font-medium truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>{profile.phone_number || "\u2014"}</span>
              </div>
              {profile.company_name && (
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span className="truncate">{profile.company_name}</span>
                </div>
              )}
            </div>

            {/* Magic Link + Refresh */}
            <div className="border-t border-amber-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-amber-900">
                  Pending Verification! Vendor has not signed in yet
                </p>
                
              </div>
              <MagicLinkResend
                email={profile.email}
                shouldCreateUser={false}
                cooldownSeconds={60}
                successMessage={`A magic link has been sent to ${profile.email}. Kindly inform the vendor to verify by signing in for the first time.`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case 3: Vendor found, signed in, no bookings */}
      {isSuccess && profile && !!profile.last_login_at && !hasBookings && (
        <Card className="border-2 border-orange-300 bg-orange-50/70 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            {/* Header – Stacked on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-100 p-2.5 sm:p-3 flex-shrink-0">
                  <User className="h-6 w-6 sm:h-7 sm:w-7 text-orange-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-orange-900 leading-tight">
                    {profile.full_name || "Vendor"} Found
                  </h3>
                  <p className="text-xs sm:text-sm text-orange-700">
                    No bookings yet • Ready to assign stall
                  </p>
                </div>
              </div>

              {/* KYC Badge – Full width on mobile */}
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-wider text-orange-600 mb-1 text-left sm:text-right">
                  KYC Status
                </p>
                {getKycBadge(profile.kyc_status)}
              </div>
            </div>

            {/* Vendor Info – Vertical stack on mobile */}
            <div className="space-y-3 text-sm bg-white/80 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-orange-600 flex-shrink-0" />
                <span className="font-medium truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-orange-600 flex-shrink-0" />
                <span>{profile.phone_number || "—"}</span>
              </div>
              {profile.company_name && (
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-orange-600 flex-shrink-0" />
                  <span className="truncate">{profile.company_name}</span>
                </div>
              )}
            </div>

            {/* Action Area */}
            <div className="mt-5 pt-4 border-t border-orange-200">
              <div className="flex flex-col md:flex-row md:justify-between gap-4">
                {/* Instruction */}
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                 
                  {profile.kyc_status === "REJECTED" && (
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm sm:text-base">
                        KYC application has been rejected
                      </p>
                      <p className="text-xs sm:text-sm text-red-700 mt-1">
                        Booking is not allowed • KYC must be approved
                      </p>
                    </div>
                  )}
                  {/* As long as KYC is not rejected you can proceed with booking */}
                  {profile.kyc_status !== "REJECTED" && (
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm sm:text-base">
                        Select any available stall below to book
                      </p>
                      <p className="text-xs sm:text-sm text-orange-700 mt-1">
                        {!profile.kyc_status? "KYC not started" :profile.kyc_status === "APPROVED" 
                          ? "Booking is allowed • KYC approved"
                          : "Booking is allowed • KYC under review"
                          
                          }
                      </p>
                    </div>
                  )}
                </div>

                {/* KYC Button – Full width on mobile */}
                {/* {!profile.kyc_status && (
                  <Button
                    onClick={() => setShowCreationModal(true)}
                    className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-medium"
                    size="lg"
                  >
                    <IdCard className="h-4 w-4 mr-2" />
                    Start KYC
                  </Button>
                )} */}
                {/* KYC Pending – Full width on mobile */}
                {profile.kyc_status === "PENDING" && (
                  <a
                    href={`/admin/kyc?contactEmail=${profile.kyc_contact_email}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-md font-medium transition-colors"
                  >
                    <IdCard className="h-4 w-4" />
                    Review KYC
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                  </a>
                )}
                {/* KYC Rejected – Full width on mobile */}
                {profile.kyc_status === "REJECTED" && (
                  <a
                    href={`/admin/kyc?contactEmail=${profile.email}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-900 rounded-md font-medium transition-colors"
                  >
                    <IdCard className="h-4 w-4" />
                    Review Rejected KYC
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case 4: Vendor found, signed in, AND has bookings */}
      {isSuccess && profile && !!profile.last_login_at && hasBookings && (
        <Card className="border-2 border-green-700 bg-green-50/90 shadow-md">
          <CardContent className="p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-700 p-2.5 sm:p-3 flex-shrink-0">
                  <User className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-900 leading-tight">
                    {profile.full_name || "Vendor"} Found
                  </h3>
                  <p className="text-sm font-medium text-green-800">
                    {data!.bookings.length} active booking
                    {data!.bookings.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* KYC Badge */}
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-wider text-green-700 mb-1">
                  KYC Status
                </p>
                {getKycBadge(profile.kyc_status)}
              </div>
            </div>

            {/* Vendor Info */}
            <div className="space-y-3 text-sm bg-white/90 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-green-700 flex-shrink-0" />
                <span className="font-medium truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-green-700 flex-shrink-0" />
                <span>{profile.phone_number || "—"}</span>
              </div>
              {profile.company_name && (
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-green-700 flex-shrink-0" />
                  <span className="truncate">{profile.company_name}</span>
                </div>
              )}
            </div>

            {/* Action Area */}
            <div className="mt-5 pt-5 border-t-2 border-green-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-green-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm sm:text-base">
                      Vendor already has assigned stall(s)
                    </p>
                    <p className="text-xs sm:text-sm text-green-800 mt-1 font-medium">
                      View, extend, or manage bookings
                    </p>
                  </div>
                </div>

                <Button
                  asChild
                  size="lg"
                  className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white font-semibold shadow-md transition-all"
                >
                  <Button onClick={onViewBookings}>
                    <Calendar className="h-4 w-4 mr-2" />
                    View Bookings ({data!.bookings.length})
                  </Button>
                </Button>
              </div>

              {/* Optional KYC reminder */}
              {!profile.kyc_status && (
                <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                  <p className="text-xs font-medium text-orange-900">
                    KYC pending – consider following up with vendor
                  </p>
                </div>
              )}
              {profile.kyc_status === "REJECTED" && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-xs font-medium text-red-900">
                    ⚠️ KYC rejected – New bookings are not allowed until KYC is approved
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

    </>
  );
};

export default VendorCheckinBooking;
