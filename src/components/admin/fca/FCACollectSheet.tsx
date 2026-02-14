import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CreditCard,
  QrCode,
  Loader2,
  CheckCircle,
  XCircle,
  Banknote,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";
import { BookingWithStalls, useFetchBookingDetails } from "@/hooks/useBookings";
import {
  useReconcileOfflineBooking,
  useSyncOfflineBooking,
} from "@/hooks/useOfflineBooking";
import {
  useRecordCashPayment,
  CashDenominations,
} from "@/hooks/useCashPayment";
import { UseMutationResult } from "@tanstack/react-query";
import CurrencyWrapper from "@/components/shared/currency";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirmDialog";

interface FCACollectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  bookingRes: UseMutationResult<BookingWithStalls, Error, string, unknown>;
}

type PaymentState = "idle" | "processing" | "success" | "failed";

// GBP denominations
const NOTE_DENOMINATIONS = [
  { label: "£50", value: "50" },
  { label: "£20", value: "20" },
  { label: "£10", value: "10" },
  { label: "£5", value: "5" },
] as const;

const COIN_DENOMINATIONS = [
  { label: "£2", value: "2" },
  { label: "£1", value: "1" },
  { label: "50p", value: "0.50" },
  { label: "20p", value: "0.20" },
  { label: "10p", value: "0.10" },
  { label: "5p", value: "0.05" },
  { label: "2p", value: "0.02" },
  { label: "1p", value: "0.01" },
] as const;

export const FCACollectSheet = ({
  open,
  onOpenChange,
  amount,
  bookingRes,
}: FCACollectSheetProps) => {
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [selectedMethod, setSelectedMethod] = useState<
    "card" | "cash" | null
  >(null);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashNotes, setCashNotes] = useState<string>("");
  const [denominations, setDenominations] = useState<CashDenominations>({});
  const [showDenominations, setShowDenominations] = useState(false);
  const [cashError, setCashError] = useState<string>("");

  const syncOffline = useSyncOfflineBooking();
  const recordCashPayment = useRecordCashPayment();
  const { user } = useAuth();

  const handleProceedWithUnpaidInvoice = async () => {
    await syncOffline.mutateAsync();
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedMethod(null);
    setCashAmount("");
    setCashNotes("");
    setDenominations({});
    setShowDenominations(false);
    setCashError("");
    setPaymentState("idle");
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  // Calculate total from denominations
  const denominationTotal = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [denom, count]) => {
      return sum + parseFloat(denom) * (count || 0);
    }, 0);
  }, [denominations]);

  // When denominations change, auto-fill the amount
  const handleDenominationChange = (key: string, count: number) => {
    const newDenominations = {
      ...denominations,
      [key]: Math.max(0, count),
    };
    setDenominations(newDenominations);

    // Calculate new total from denominations
    const total = Object.entries(newDenominations).reduce(
      (sum, [denom, c]) => sum + parseFloat(denom) * (c || 0),
      0
    );
    if (total > 0) {
      setCashAmount(total.toFixed(2));
    }
  };

  const confirm = useConfirm();

  // Validate cash amount
  const validateCashAmount = async(): Promise<boolean> => {
    const numAmount = parseFloat(cashAmount);
    if (!cashAmount || isNaN(numAmount)) {
      setCashError("Please enter the cash amount collected.");
      return false;
    }
    if (numAmount <= 0) {
      setCashError("Amount must be greater than zero.");
      return false;
    }
    if (numAmount < amount) {
      setCashError(
        `Amount collected (${formatCurrency(numAmount)}) is less than the amount due (${formatCurrency(amount)}).`
      );
      return false;
    }
    if (numAmount > amount) {
      const confirmed = await confirm({
        title: "Confirm Overpayment",
        description: `Are you sure you want to collect ${formatCurrency(numAmount)} when the amount due is ${formatCurrency(amount)}?`,
        confirmText: "Confirm",
        cancelText: "Cancel",
      });
      if (!confirmed) {
        return false;
      }

    }
    setCashError("");
    return true;
  };

  const handleCashSubmit = async () => {
    const isValid = await validateCashAmount();
    if (!isValid) return;
    if (!user || !bookingRes.data?.id) return;

    setPaymentState("processing");

    try {
      // Check if any denominations were actually entered
      const hasDenominations = Object.values(denominations).some(
        (v) => (v || 0) > 0
      );

      await recordCashPayment.mutateAsync({
        bookingId: bookingRes.data.id,
        amount: parseFloat(cashAmount),
        collectedBy: user.id,
        denominations: hasDenominations ? denominations : null,
        notes: cashNotes || `FCA cash collection - ${formatCurrency(parseFloat(cashAmount))}`,
      });

      setPaymentState("success");

      // Refresh booking data after short delay
      setTimeout(async () => {
        if (bookingRes.data?.id) {
          await bookingRes.mutateAsync(bookingRes.data.id);
        }
        handleClose();
      }, 1500);
    } catch (error) {
      setPaymentState("failed");
    }
  };

  const isLoading =
    bookingRes?.isPending || syncOffline?.isPending || recordCashPayment.isPending;

  const renderCashPaymentForm = () => {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedMethod(null)}
          className="mb-2 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Amount Due:</span>
            <span className="text-2xl font-bold">
              <CurrencyWrapper amount={amount} />
            </span>
          </div>
        </div>

        {/* Cash Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="cashAmount" className="text-sm font-medium">
            Cash Amount Collected *
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              <CurrencyWrapper />
            </span>
            <Input
              id="cashAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={cashAmount}
              onChange={(e) => {
                setCashAmount(e.target.value);
                setCashError("");
              }}
              className="pl-7 text-lg font-semibold h-12"
            />
          </div>
          {cashError && (
            <p className="text-sm text-destructive font-medium">{cashError}</p>
          )}
        </div>

        {/* Optional denomination breakdown */}
        <Collapsible
          open={showDenominations}
          onOpenChange={setShowDenominations}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground"
            >
              <span className="text-sm">
                Denomination Breakdown (Optional)
              </span>
              {showDenominations ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {/* Notes */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Notes
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {NOTE_DENOMINATIONS.map((d) => (
                  <div
                    key={d.value}
                    className="flex items-center gap-2 bg-background border rounded-md p-2"
                  >
                    <span className="text-sm font-medium w-10">
                      {d.label}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={
                        denominations[
                          d.value as keyof CashDenominations
                        ] || ""
                      }
                      onChange={(e) =>
                        handleDenominationChange(
                          d.value,
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="h-8 text-center"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Coins */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Coins
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {COIN_DENOMINATIONS.map((d) => (
                  <div
                    key={d.value}
                    className="flex items-center gap-2 bg-background border rounded-md p-2"
                  >
                    <span className="text-sm font-medium w-10">
                      {d.label}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={
                        denominations[
                          d.value as keyof CashDenominations
                        ] || ""
                      }
                      onChange={(e) =>
                        handleDenominationChange(
                          d.value,
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="h-8 text-center"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {denominationTotal > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Denomination Total:
                </span>
                <span className="font-semibold">
                  <CurrencyWrapper amount={denominationTotal} />
                </span>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="cashNotes" className="text-sm font-medium">
            Notes (Optional)
          </Label>
          <Textarea
            id="cashNotes"
            placeholder="Any additional notes about this cash collection..."
            value={cashNotes}
            onChange={(e) => setCashNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Submit */}
        <Button
          className="w-full h-12 text-base"
          size="lg"
          onClick={handleCashSubmit}
          disabled={isLoading || !cashAmount}
        >
          {recordCashPayment.isPending && (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          )}
          <Banknote className="h-5 w-5 mr-2" />
          Confirm Cash Payment
        </Button>
      </div>
    );
  };

  const renderPaymentState = () => {
    if (paymentState === "processing") {
      return (
        <div className="py-12 text-center space-y-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Processing Payment...</h3>
            <p className="text-sm text-muted-foreground">
              {selectedMethod === "card"
                ? "Please follow instructions on the card machine"
                : "Recording cash payment..."}
            </p>
          </div>
        </div>
      );
    }

    if (paymentState === "success") {
      return (
        <div className="py-12 text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-green-600">
              Payment Successful!
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedMethod === "cash"
                ? `Cash payment of ${formatCurrency(parseFloat(cashAmount))} recorded.`
                : "Booking confirmed. Redirecting..."}
            </p>
          </div>
        </div>
      );
    }

    if (paymentState === "failed") {
      return (
        <div className="py-12 text-center space-y-6">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-destructive">
              Payment Failed
            </h3>
            <p className="text-sm text-muted-foreground">
              The payment could not be processed. Please try again.
            </p>
          </div>
          <Button onClick={handleReset} variant="outline" className="w-full">
            Try Again
          </Button>
        </div>
      );
    }

    // Show cash payment form when cash is selected
    if (selectedMethod === "cash") {
      return renderCashPaymentForm();
    }

    return (
      <div className="space-y-6">
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Amount Due:</span>
            <span className="text-2xl font-bold">
              <CurrencyWrapper amount={amount} />
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Select Payment Method:
          </h3>
          <div>
            <Button
              disabled={isLoading}
              variant="outline"
              className="w-full h-auto p-4 justify-start hover:border-primary"
              onClick={handleProceedWithUnpaidInvoice}
            >
              <CreditCard className="h-5 w-5 mr-3" />
              {syncOffline?.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <div className="text-left flex-1">
                <div className="font-semibold">POS Machine (Zettle)</div>
                <div className="text-xs text-muted-foreground">
                  Tap, insert card or collect cash
                </div>
              </div>
              <Badge variant="default">Recommended</Badge>
            </Button>
          </div>

          {/* Cash Payment Option */}
          <div>
            <Button
              disabled={isLoading}
              variant="outline"
              className="w-full h-auto p-4 justify-start hover:border-primary"
              onClick={() => {
                setSelectedMethod("cash");
                setCashAmount(amount.toFixed(2));
              }}
            >
              <Banknote className="h-5 w-5 mr-3" />
              <div className="text-left flex-1">
                <div className="font-semibold">Cash Payment</div>
                <div className="text-xs text-muted-foreground">
                  Record cash collected from vendor
                </div>
              </div>
              <Badge variant="secondary">Manual</Badge>
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start opacity-50 cursor-not-allowed"
            disabled
          >
            <QrCode className="h-5 w-5 mr-3" />
            <div className="text-left flex-1">
              <div className="font-semibold">QR Code Payment</div>
              <div className="text-xs text-muted-foreground">Coming soon</div>
            </div>
            <Badge variant="secondary">Soon</Badge>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={paymentState === "idle" ? handleClose : undefined}
    >
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Collect Payment</SheetTitle>
          <SheetDescription>
            {selectedMethod === "cash"
              ? "Enter the cash amount collected from the vendor"
              : "Process offline payment for this booking"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">{renderPaymentState()}</div>
      </SheetContent>
    </Sheet>
  );
};
