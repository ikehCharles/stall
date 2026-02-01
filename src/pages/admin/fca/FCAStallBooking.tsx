import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Briefcase, Camera, LayoutGrid, Map } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { StallInstance, useStallInstances } from "@/hooks/useStallInstances";
import { useStallHolds } from "@/hooks/useStallHolds";
import { useBookingDates } from "@/hooks/useBookingDates";
import { FCABookingModal } from "@/components/admin/fca/FCABookingModal";
import { StallCanvasView } from "@/components/shared/StallCanvasView";
import { Loader2 } from "lucide-react";
import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { ScanModal } from "@/components/shared/ScanModal";
import { useFetchBookingDetails } from "@/hooks/useBookings";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "@/hooks/use-toast";
import CheckingBookingByQR from "@/components/admin/fca/CheckingBookingByQR";
import { VendorLookup } from "@/components/admin/fca/VendorLookup";
import CheckingBookingsByEmail from "@/components/admin/fca/CheckingBookingsByEmail";
import { UserBookingsResponse } from "@/hooks/useVendorLookup";
import { FCAVendorCreationModal } from "@/components/admin/fca/FCAVendorCreationModal";
import { Booking } from "@/data/mockData";
import { generateInvoiceUrl } from "@/lib/utils";
import { PostgrestError } from "@supabase/supabase-js";
import CurrencyWrapper from "@/components/shared/currency";

const FCAStallBooking = () => {
  const { marketId } = useParams();
  const navigate = useNavigate();
  const [selectedStall, setSelectedStall] = useState<StallInstance | null>(
    null
  );
  const bookingRes = useFetchBookingDetails();
  const [scanOpen, setScanOpen] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [vendorLookupError, setVendorLookupError] =
    useState<PostgrestError | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [openBookings, setOpenBookings] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "canvas">("list");

  const [bookingsWithProfile, setBookingsWithProfile] =
    useState<UserBookingsResponse | null>(null);

  const market = useMarkets();
  const stalls = useStallInstances(marketId || "");
  // const stallHolds = useStallHolds(marketId || "");
  const bookingDates = useBookingDates(marketId || "");

  const currentMarket = market.data?.find((m) => m.id === marketId);

  const onScanResult = async (text) => {
    const bookingId = text.split("/").pop() || "";

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        bookingId
      );

    if (!isUUID) {
      toast({
        title: "Invalid QR Code",
        description: "Scanned QR code is not a valid booking ID.",
        variant: "destructive",
      });
      return;
    }

    await bookingRes.mutateAsync(bookingId);
    const adminInvoiceUrl = `/admin/fca/invoices/${bookingId}`
    setInvoiceUrl(adminInvoiceUrl);
  };

  const handleVendorFound = (bookingsWithProfile: UserBookingsResponse) => {
    setVendorLookupError(null);
    setBookingsWithProfile(bookingsWithProfile);
  };
  const handleVendorLookupError = (err) => {
    setVendorLookupError(err);
  };

  const handleStallClick = (stall: StallInstance) => {
    
    if (!bookingsWithProfile && !vendorLookupError) {
      toast({
        title: "Kindly enter an email",
        description:
          "Provide email and click search to get vendors record before checking out stalls",
        variant: 'warning',
      });
      return;
    }
    
    // On any error do not allow stall selection
    if (vendorLookupError || !bookingsWithProfile?.profile?.kyc_status || bookingsWithProfile?.profile?.kyc_status === 'REJECTED') return;
    const available = isStallAvailable(stall);
    if (!available) {
      toast({
        title:
          stall.status === "BOOKED"
            ? "Stall is currently booked out"
            : "Stall is currently unavailable",
        variant: "destructive",
      });
      return;
    }
    
    // if (stall.status === 'AVAILABLE') {
    setSelectedStall(stall);
    setShowModal(true);
    // }
  };

  // Get booked dates for the selected stall
  const getBookedDatesForStall = (stallId: string): Date[] => {
    if (!bookingDates.data || !currentMarket) return [];

    return bookingDates.data
      .filter((bd) => bd.stall_instance_id === stallId)
      .map((bd) => startOfDay(new Date(bd.booking_date)));
  };

  // Check if stall has ANY available date in market window
  const isStallAvailable = (stall: StallInstance): boolean => {
    if (!currentMarket) return false;

    const marketDates = eachDayOfInterval({
      start: startOfDay(new Date(currentMarket.start_at)),
      end: startOfDay(new Date(currentMarket.end_at)),
    });

    const bookedDates = getBookedDatesForStall(stall.id);

    // Available if at least ONE date in market window is not booked
    return marketDates.some(
      (marketDate) =>
        !bookedDates.some(
          (bookedDate) => bookedDate.getTime() === marketDate.getTime()
        )
    );
  };

  const getStallColorForFCA = (stall: StallInstance) => {
    const available = isStallAvailable(stall);
    if (available) return "#22c55e"; // green - available
    return "#ef4444"; // red - fully booked
  };

  const onSelectBooking = async (
    booking: UserBookingsResponse["bookings"][0]
  ) => {
    const invoiceUrl = generateInvoiceUrl(booking.id);
    await bookingRes.mutateAsync(booking.id);
    const adminInvoiceUrl = `/admin/fca/invoices/${booking.id}`
    setInvoiceUrl(adminInvoiceUrl);
  };

  const onViewBookings = () => {
    setOpenBookings(true);
  };

  if (stalls.isLoading || market.isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!currentMarket) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Market not found</h2>
          <Button
            onClick={() => navigate("/admin/fca/markets")}
            className="mt-4"
          >
            Back to Markets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 px-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="px-0"
            onClick={() => navigate("/admin/fca/markets")}
          >
            <ArrowLeft className="h-4 w-4" />
            Markets
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            <Briefcase className="h-4 w-4 mr-2" />
            FCA Mode
          </Badge>
          <Button
            variant="outline"
            onClick={() => navigate("/admin")}
            size="sm"
          >
            Exit FCA Mode
          </Button>
        </div>
      </div>
      <div className=" md:hidden flex items-center flex-wrap gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          {currentMarket.name}
        </h1>
        (
        <p className="text-sm text-muted-foreground">
          {format(new Date(currentMarket.start_at), "MMM d")} -{" "}
          {format(new Date(currentMarket.end_at), "MMM d, yyyy")}
        </p>
        )
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden md:flex items-center gap-1">
          <h1 className="text-2xl font-bold text-foreground">
            {currentMarket.name}
          </h1>
          (
          <p className="text-sm text-muted-foreground">
            {format(new Date(currentMarket.start_at), "MMM d")} -{" "}
            {format(new Date(currentMarket.end_at), "MMM d, yyyy")}
          </p>
          )
         
        </div>
        <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-2 flex-wrap">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              bookingRes.reset();
              setInvoiceUrl("");
              setScanOpen(true);
            }}
            className="flex items-center justify-center"
          >
            <Camera className="h-4 w-4" />
            Scan QR
          </Button>
          <div className="flex items-center">
            <Toggle
              variant={viewMode === "list" ? "default" : "outline"}
              pressed={viewMode === "list"}
              onPressedChange={() => setViewMode("list")}
              className="Toggle"
              aria-label="List View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Toggle>

            <Toggle
              variant={viewMode === "canvas" ? "default" : "outline"}
              pressed={viewMode === "canvas"}
              onPressedChange={() => setViewMode("canvas")}
              className="Toggle"
              aria-label="Canvas View"
            >
              <Map className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
      </div>
      <div className="">
      <VendorLookup
        market={currentMarket}
        onVendorFound={handleVendorFound}
        onVendorLookupError={handleVendorLookupError}
        onViewBookings={onViewBookings}
      />
      </div>

      {viewMode === "list" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stalls.data?.map((stall) => {
            const available = isStallAvailable(stall);
            const statusVariant = available ? "default" : "destructive";
            const statusText = available ? "Available" : "Booked";

            return (
              <Card
                key={stall.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  available ? "hover:border-primary" : "opacity-60"
                }`}
                onClick={() => handleStallClick(stall)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{stall.label}</CardTitle>
                    <Badge variant={statusVariant}>{statusText}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <strong>Template:</strong>{" "}
                    {stall.stall_templates?.name || "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Price: </strong> 
                    <CurrencyWrapper amount={(
                      stall.price_override ||
                      stall.stall_templates?.price ||
                      0
                    )} />
                    
                    /day
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">🗺️</span>
              Stall Layout - {currentMarket.name}
            </CardTitle>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                Available
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                Fully Booked
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StallCanvasView
              stalls={stalls.data || []}
              onStallClick={handleStallClick}
              getStallColor={getStallColorForFCA}
            />
          </CardContent>
        </Card>
      )}

      {selectedStall && bookingsWithProfile?.profile && (
        <FCABookingModal
          open={showModal}
          onOpenChange={setShowModal}
          stall={selectedStall}
          market={currentMarket}
          vendor={bookingsWithProfile.profile}
          // bookedDates={selectedStall ? getBookedDatesForStall(selectedStall.id) : []}
        />
      )}

      {!!bookingsWithProfile && !!bookingsWithProfile.bookings.length && (
        <CheckingBookingsByEmail
          open={openBookings}
          onOpenChange={() => setOpenBookings(false)}
          bookingsWithprofile={bookingsWithProfile}
          market={currentMarket}
          onSelectBooking={onSelectBooking}
        />
      )}

      {!!invoiceUrl && (
        <CheckingBookingByQR
          open={!!invoiceUrl}
          onOpenChange={() => setInvoiceUrl("")}
          bookingRes={bookingRes}
          market={currentMarket}
          invoiceUrl={invoiceUrl}
        />
      )}

      {scanOpen && (
        <ScanModal
          open={scanOpen}
          onClose={() => {
            setScanOpen(false);
          }}
          onScan={onScanResult}
        />
      )}
    </div>
  );
};

export default FCAStallBooking;
