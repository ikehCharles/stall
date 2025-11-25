import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import {
  UserBookingsResponse,
  useVendorLookup,
  useVendorLookupInMarket,
  VendorLookupResult,
} from "@/hooks/useVendorLookup";
import { Loader2 } from "lucide-react";
import { useFetchBookingDetails } from "@/hooks/useBookings";
import VendorCheckinBooking from "./VendorProfileCheckinBooking";
import { useState } from "react";
import { Market } from "@/hooks/useMarkets";
import { isValidEmail } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PostgrestError } from "@supabase/supabase-js";

interface VendorLookupProps {
  onVendorFound: (bookingsWithProfile: UserBookingsResponse) => void;
  onVendorLookupError: (err: PostgrestError) => void;
  market: Market;
  onViewBookings: () => void;
}

export const VendorLookup = ({
  onVendorFound,
  onVendorLookupError,
  market,
  onViewBookings,
}: VendorLookupProps) => {
  const [email, setEmail] = useState("");
  const vendorLookup = useVendorLookupInMarket();
  const bookingRes = useFetchBookingDetails();

  const handleSearch = () => {
    bookingRes.reset();
    if (!email.trim()) return;
    if (!isValidEmail(email)) {
      toast({
        title: "Invalid Email",
        variant: "destructive",
      });
      return;
    }

    vendorLookup.mutate(
      { email, marketId: market.id },
      {
        onSuccess: (vendor) => {
          onVendorFound(vendor);
        },
        onError: (err) => {
          onVendorLookupError(err);
        },
      }
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex">
          {/* <div className="flex-1"> */}
            <Input
              type="email"
              placeholder="Find by vendor email..."
              value={email}
              className="lg:w-[300px] rounded-r-none"
              onChange={(e) => {
                // bookingRes.reset();
                // vendorLookup.reset();
                setEmail(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={vendorLookup.isPending}
            />
          {/* </div> */}
          <Button
            onClick={handleSearch}
            disabled={!email.trim() || vendorLookup.isPending}
            className="rounded-l-none"
          >
            {vendorLookup.isPending || bookingRes.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        <VendorCheckinBooking
          market={market}
          vendorLookup={vendorLookup}
          email={email}
          onViewBookings={onViewBookings}
          onSuccessVendorCreation={handleSearch}
        />
      </div>
    </>
  );
};
