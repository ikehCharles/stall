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
import { useState, useEffect, useRef, useCallback } from "react";
import { Market } from "@/hooks/useMarkets";
import { isValidEmail } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PostgrestError } from "@supabase/supabase-js";
import { useSearchParams } from "react-router-dom";

interface VendorLookupProps {
  onVendorFound: (bookingsWithProfile: UserBookingsResponse) => void;
  onVendorLookupError: (err: PostgrestError) => void;
  onVendorCleared?: () => void;
  market: Market;
  onViewBookings: () => void;
}

export const VendorLookup = ({
  onVendorFound,
  onVendorLookupError,
  onVendorCleared,
  market,
  onViewBookings,
}: VendorLookupProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const vendorLookup = useVendorLookupInMarket();
  const bookingRes = useFetchBookingDetails();

  // Perform the actual search
  const performSearch = useCallback((emailToSearch: string) => {
    bookingRes.reset();
    if (!emailToSearch.trim()) return;
    if (!isValidEmail(emailToSearch)) {
      toast({
        title: "Invalid Email",
        variant: "destructive",
      });
      return;
    }

    vendorLookup.mutate(
      { email: emailToSearch, marketId: market.id },
      {
        onSuccess: (vendor) => {
          onVendorFound(vendor);
        },
        onError: (err) => {
          onVendorLookupError(err);
        },
      }
    );
  }, [bookingRes, vendorLookup, market.id, onVendorFound, onVendorLookupError]);

  // Initialize email from URL params on mount and auto-search if email exists
  useEffect(() => {

    const emailParam = searchParams.get("vendorEmail");
    if (emailParam) {
      setEmail(emailParam);
      // Auto-trigger search if email is valid
      if (isValidEmail(emailParam)) {
        performSearch(emailParam);
      }
    }
  }, []); // Only run on mount

  const handleSearch = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    // Update URL search params with email
    const newSearchParams = new URLSearchParams(searchParams);
    if (trimmedEmail) {
      newSearchParams.set('vendorEmail', trimmedEmail);
    } else {
      newSearchParams.delete('vendorEmail');
    }
    setSearchParams(newSearchParams, { replace: true });

    // Perform search
    performSearch(trimmedEmail);
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
              bookingRes.reset();
              if(!e.target.value.trim()) {
                setSearchParams(new URLSearchParams(), { replace: true });
              }
              vendorLookup.reset();
              onVendorCleared?.();
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
        />
      </div>
    </>
  );
};
