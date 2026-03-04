import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VendorLookup } from "./VendorLookup";
import { BookingCalendar } from "@/components/vendor/BookingCalendar";
import {
  Profile,
  UnpaidInvoice,
  useUnpaidInvoice,
  VendorLookupResult,
} from "@/hooks/useVendorLookup";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertCircle, ArrowRight, Calendar, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Market } from "@/hooks/useMarkets";
import { StallInstance } from "@/hooks/useStallInstances";
import { BookingDate } from "@/hooks/useBookingDates";
import { UserPayload } from "@/hooks/useUsers";
import { KYCData } from "@/lib/localStorage";
import { User } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserRegister from "@/pages/auth/UserRegister";
import { KYCForm } from "@/components/kyc/KYCForm";
import { MagicLinkResend } from "./MagicLinkResend";

interface FCAVendorCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  user: Partial<Profile>;
}

enum ModalState {
  vendorCreation,
  kycProcessing,
}

export const FCAVendorCreationModal = ({
  open,
  onOpenChange,
  user,
  onSuccess,
}: FCAVendorCreationModalProps) => {
  const navigate = useNavigate();
  const [state, setState] = useState<ModalState>(ModalState.vendorCreation);
  const [vendor, setVendor] = useState<Partial<
    UserPayload & { id?: string }
  > | null>(null);
  const [vendorCreated, setVendorCreated] = useState(false);

  useEffect(() => {
    if (user?.user_id) {
      setState(ModalState.kycProcessing);
    }
    if (vendor?.email) return;
    setVendor({
      email: user.email,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      id: user.user_id,
    });
  }, [user]);


  const handleNewVendor = async (user: User) => {
    const userPayload = {
      ...user,
      fullName: user.user_metadata.full_name,
      phoneNumber: user.user_metadata.phone_number,
    };
    setVendor(userPayload);
    setVendorCreated(true);
    setState(ModalState.kycProcessing);
  };

  const handleKYCSubmit = () => {
    toast({
      title: "Vendor created with pending KYC",
      description: `You can proceed to booking a stall for vendor with fullname ${vendor.fullName} & email ${vendor.email}`,
    });
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            FCA Vendor Entry
          </DialogTitle>
        </DialogHeader>

        <Tabs value={state.toString()} defaultValue={state.toString()}>
          <TabsList>
            <TabsTrigger value={ModalState.vendorCreation.toString()}>
              Vendor Creation
            </TabsTrigger>
            <TabsTrigger
              disabled={!vendor?.id}
              value={ModalState.kycProcessing.toString()}
            >
              KYC Processing
            </TabsTrigger>
          </TabsList>

          <div className="pt-3">
            <TabsContent value={ModalState.vendorCreation.toString()}>
              <Card className="w-full max-w-2xl">
                <CardHeader>
                  <CardTitle>Vendor Profile</CardTitle>
                  <CardDescription>
                    Please provide information to set up profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <UserRegister
                    user={vendor}
                    onUserCreated={(userRes) => {
                      handleNewVendor(userRes.user);
                    }}
                    disabled={!!vendor?.id}
                    isVendor={true}
                  />

                  {/* Magic link section — shown after vendor is created */}
                  {vendorCreated && vendor?.email && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Account Verification
                      </p>
                      <MagicLinkResend
                        email={vendor.email}
                        autoSend={true}
                        cooldownSeconds={60}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
              {!!vendor?.id && (
                <div className="flex justify-center items-center">
                  <Button className="mt-5 mb-3">
                    Next
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value={ModalState.kycProcessing.toString()}>
              {vendor?.id && (
                <KYCForm
                  externalUserId={vendor?.id}
                  existingKYC={{
                    contact_email: vendor?.email,
                    contact_phone: vendor?.phoneNumber,
                  }}
                  partialUpload={true}
                  onSubmit={handleKYCSubmit}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
