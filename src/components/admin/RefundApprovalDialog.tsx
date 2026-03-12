import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader } from "lucide-react";
import { BookingWithStalls } from "@/hooks/useBookings";
import CurrencyWrapper from "@/components/shared/currency";
import {
  getPaymentStatusBadge,
  getStatusBadge,
} from "@/components/shared/statuses";

type RefundMode = "reject" | "request" | "approve" | "reject_refund";

interface RefundApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingWithStalls | null;
  mode: RefundMode;
  isPending: boolean;
  onConfirm: (reason: string) => void;
}

const modeConfig: Record<
  RefundMode,
  {
    title: string;
    description: string;
    confirmText: string;
    confirmClassName: string;
    reasonLabel: string;
    reasonPlaceholder: string;
  }
> = {
  reject: {
    title: "Reject Booking",
    description:
      "Reject this booking. The payment status will remain unchanged. If a refund is needed, it can be requested after rejection.",
    confirmText: "Reject Booking",
    confirmClassName: "bg-red-600 hover:bg-red-700 text-white",
    reasonLabel: "Reason for Rejection *",
    reasonPlaceholder: "Explain why this booking is being rejected...",
  },
  request: {
    title: "Request Refund",
    description:
      "Submit a refund request for this cancelled booking. An authorised user will need to approve it before the refund is processed.",
    confirmText: "Submit Refund Request",
    confirmClassName: "bg-yellow-600 hover:bg-yellow-700 text-white",
    reasonLabel: "Reason for Refund *",
    reasonPlaceholder: "Explain why this refund is being requested...",
  },
  approve: {
    title: "Approve & Execute Refund",
    description:
      "You are about to approve and execute a refund for this booking. The payment will be reversed via the original payment method. This action cannot be undone.",
    confirmText: "Approve & Refund",
    confirmClassName: "bg-red-600 hover:bg-red-700 text-white",
    reasonLabel: "Approval Notes *",
    reasonPlaceholder: "Add any notes for approving this refund...",
  },
  reject_refund: {
    title: "Reject Refund Request",
    description:
      "Reject the pending refund request. The booking will remain cancelled.",
    confirmText: "Reject Request",
    confirmClassName: "bg-gray-600 hover:bg-gray-700 text-white",
    reasonLabel: "Rejection Reason *",
    reasonPlaceholder: "Explain why this refund request is being rejected...",
  },
};

export const RefundApprovalDialog = ({
  open,
  onOpenChange,
  booking,
  mode,
  isPending,
  onConfirm,
}: RefundApprovalDialogProps) => {
  const [reason, setReason] = useState("");

  const config = modeConfig[mode];

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) setReason("");
    onOpenChange(newOpen);
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking summary */}
          <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-medium">{booking.invoice_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Market</span>
              <span className="font-medium">
                {booking.markets?.name || "N/A"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stalls</span>
              <span className="font-medium">
                {booking.booking_stalls?.length || 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold">
                <CurrencyWrapper amount={booking.total_amount} />
              </span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Booking Status</span>
              {getStatusBadge(booking.status)}
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Payment Status</span>
              {getPaymentStatusBadge(booking.payment_status)}
            </div>
            {(mode === "approve" || mode === "reject_refund") && booking.refund_status === "requested" && booking.refund_reason && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">
                  Original refund reason:
                </p>
                <p className="text-sm italic">
                  &ldquo;{booking.refund_reason}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <Label htmlFor="refund-reason">
              {config.reasonLabel}
            </Label>
            <Textarea
              id="refund-reason"
              placeholder={config.reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            className={config.confirmClassName}
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? (
              <Loader className="w-4 h-4 mr-1 animate-spin" />
            ) : null}
            {config.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
