import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import CurrencyWrapper from "@/components/shared/currency";

/** Subset of booking fields relevant to VAT */
interface BookingVatFields {
  total_amount: number;
  vat_rate_at_booking?: number | null;
  vat_mode_at_booking?: string | null;
  vat_amount?: number | null;
  net_amount?: number | null;
  gross_amount?: number | null;
}

/** Subset of platform settings relevant to VAT */
interface VatSettings {
  vatRate?: number;
  vatMode?: string;
}

interface VatBreakdownProps {
  booking: BookingVatFields;
  settings?: VatSettings | null;
}

function resolveVat(booking: BookingVatFields, settings?: VatSettings | null) {
  const total = booking.total_amount;
  const rate = booking.vat_rate_at_booking ?? settings?.vatRate ?? 20;
  const mode = booking.vat_mode_at_booking ?? settings?.vatMode ?? "exclusive";
  const hasVat = booking.vat_rate_at_booking != null;

  const vat =
    booking.vat_amount ??
    (mode === "exclusive"
      ? Math.round(total * (rate / 100) * 100) / 100
      : Math.round((total - total / (1 + rate / 100)) * 100) / 100);

  const net = booking.net_amount ?? (mode === "exclusive" ? total : total - vat);
  const gross = booking.gross_amount ?? (mode === "exclusive" ? net + vat : total);

  return { rate, mode, vat, net, gross, hasVat };
}

const Row = ({ label, amount, className = "" }: { label: string; amount: number; className?: string }) => (
  <div className={`flex justify-between ${className}`}>
    <span>{label}</span>
    <span><CurrencyWrapper amount={amount} /></span>
  </div>
);

const VatBreakdown = ({ booking, settings }: VatBreakdownProps) => {
  const { rate, mode, vat, net, gross, hasVat } = useMemo(
    () => resolveVat(booking, settings),
    [booking, settings]
  );

  if (!hasVat) {
    return (
      <>
        <Row label="Subtotal:" amount={booking.total_amount} />
        <div className="flex justify-between text-muted-foreground">
          <span>VAT:</span>
          <span className="text-sm italic">N/A</span>
        </div>
        <Separator />
        <Row label="Total:" amount={booking.total_amount} className="text-lg font-bold" />
      </>
    );
  }

  if (mode === "exclusive") {
    return (
      <>
        <Row label="Subtotal (excl. VAT):" amount={net} className="text-sm text-muted-foreground [&>span:last-child]:font-medium [&>span:last-child]:text-foreground" />
        <Row label={`VAT (${rate}%):`} amount={vat} className="text-sm text-muted-foreground [&>span:last-child]:font-medium [&>span:last-child]:text-foreground" />
        <Separator />
        <Row label="Total (incl. VAT):" amount={gross} className="text-lg font-bold" />
      </>
    );
  }

  return (
    <>
      <Row label="Total (incl. VAT):" amount={gross} className="text-sm text-muted-foreground [&>span:last-child]:font-medium [&>span:last-child]:text-foreground" />
      <Row label={`of which VAT (${rate}%):`} amount={vat} className="text-xs text-muted-foreground [&>span:last-child]:text-sm [&>span:last-child]:text-foreground" />
      <Row label="Net amount:" amount={net} className="text-xs text-muted-foreground [&>span:last-child]:text-sm [&>span:last-child]:text-foreground" />
      <Separator />
      <Row label="Total Amount:" amount={gross} className="text-lg font-bold" />
    </>
  );
};

export default VatBreakdown;
