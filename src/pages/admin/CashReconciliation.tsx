import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Banknote,
  Calendar,
  Download,
  Eye,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  useCashPaymentsReconciliation,
  CashPaymentRecord,
  CashDenominations,
} from "@/hooks/useCashPayment";
import CurrencyWrapper from "@/components/shared/currency";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

const CashReconciliation = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedPayment, setSelectedPayment] =
    useState<CashPaymentRecord | null>(null);

  const { data: cashPayments, isLoading } = useCashPaymentsReconciliation({
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo
      ? new Date(dateTo + "T23:59:59").toISOString()
      : undefined,
  });

  const filteredPayments = useMemo(() => {
    if (!cashPayments) return [];
    if (!searchTerm) return cashPayments;
    const term = searchTerm.toLowerCase();
    return cashPayments.filter(
      (p) =>
        p.invoice_number?.toLowerCase().includes(term) ||
        p.vendor_name?.toLowerCase().includes(term) ||
        p.collector_name?.toLowerCase().includes(term) ||
        p.market_name?.toLowerCase().includes(term)
    );
  }, [cashPayments, searchTerm]);

  // Summary statistics
  const stats = useMemo(() => {
    if (!filteredPayments.length)
      return { totalCollected: 0, totalTransactions: 0, uniqueCollectors: 0 };
    return {
      totalCollected: filteredPayments.reduce((s, p) => s + p.amount, 0),
      totalTransactions: filteredPayments.length,
      uniqueCollectors: new Set(filteredPayments.map((p) => p.collected_by))
        .size,
    };
  }, [filteredPayments]);

  const renderDenominationBreakdown = (
    denominations: CashDenominations | null
  ) => {
    if (!denominations) return <span className="text-muted-foreground italic text-sm">Not recorded</span>;

    const entries = Object.entries(denominations).filter(
      ([, count]) => (count || 0) > 0
    );
    if (entries.length === 0) return <span className="text-muted-foreground italic text-sm">Not recorded</span>;

    return (
      <div className="space-y-1">
        {entries.map(([denom, count]) => {
          const denomValue = parseFloat(denom);
          const label =
            denomValue >= 1 ? `£${denom}` : `${Math.round(denomValue * 100)}p`;
          return (
            <div key={denom} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}:</span>
              <span>
                {count} × = {formatCurrency(denomValue * (count || 0))}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const handleExportCSV = () => {
    if (!filteredPayments.length) return;

    const headers = [
      "Date",
      "Invoice",
      "Market",
      "Vendor",
      "Amount",
      "Collected By",
      "Notes",
    ];
    const rows = filteredPayments.map((p) => [
      format(new Date(p.created_at), "yyyy-MM-dd HH:mm"),
      p.invoice_number,
      p.market_name,
      p.vendor_name,
      p.amount.toFixed(2),
      p.collector_name,
      p.notes || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-reconciliation-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Cash Reconciliation
          </h1>
          <p className="text-gray-600 mt-1">
            Review and reconcile all cash payments collected by FCA agents
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={!filteredPayments.length}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-50">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Collected</p>
              <p className="text-2xl font-bold">
                <CurrencyWrapper amount={stats.totalCollected} />
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50">
              <Banknote className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-2xl font-bold">{stats.totalTransactions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-50">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">FCA Collectors</p>
              <p className="text-2xl font-bold">{stats.uniqueCollectors}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice, vendor, collector, or market..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Payments Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Cash Payment Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Collected By</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No cash payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        <div>
                          {format(
                            new Date(payment.created_at),
                            "MMM d, yyyy"
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(payment.created_at), "HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.invoice_number}
                      </TableCell>
                      <TableCell>{payment.market_name}</TableCell>
                      <TableCell>{payment.vendor_name}</TableCell>
                      <TableCell className="font-semibold">
                        <CurrencyWrapper amount={payment.amount} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{payment.collector_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {payment.collector_email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPayment(payment)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Cash Payment Details</DialogTitle>
                            </DialogHeader>
                            {selectedPayment && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Invoice
                                    </Label>
                                    <p className="font-medium">
                                      {selectedPayment.invoice_number}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Amount Collected
                                    </Label>
                                    <p className="font-bold text-lg">
                                      <CurrencyWrapper
                                        amount={selectedPayment.amount}
                                      />
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Market
                                    </Label>
                                    <p className="font-medium">
                                      {selectedPayment.market_name}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Vendor
                                    </Label>
                                    <p className="font-medium">
                                      {selectedPayment.vendor_name}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Collected By
                                    </Label>
                                    <p className="font-medium">
                                      {selectedPayment.collector_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {selectedPayment.collector_email}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Date & Time
                                    </Label>
                                    <p className="font-medium">
                                      {format(
                                        new Date(selectedPayment.created_at),
                                        "MMM d, yyyy HH:mm"
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="border-t pt-4">
                                  <Label className="text-xs text-muted-foreground">
                                    Denomination Breakdown
                                  </Label>
                                  <div className="mt-2 p-3 bg-muted rounded-lg">
                                    {renderDenominationBreakdown(
                                      selectedPayment.denominations
                                    )}
                                  </div>
                                </div>

                                {selectedPayment.notes && (
                                  <div className="border-t pt-4">
                                    <Label className="text-xs text-muted-foreground">
                                      Notes
                                    </Label>
                                    <p className="mt-1 text-sm">
                                      {selectedPayment.notes}
                                    </p>
                                  </div>
                                )}

                                <div className="border-t pt-4">
                                  <Label className="text-xs text-muted-foreground">
                                    Booking Total
                                  </Label>
                                  <p className="font-medium">
                                    <CurrencyWrapper
                                      amount={selectedPayment.booking_total}
                                    />
                                  </p>
                                  <div className="mt-1">
                                    {selectedPayment.amount >=
                                    selectedPayment.booking_total ? (
                                      <Badge variant="success">
                                        Fully Paid
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive">
                                        Underpaid by{" "}
                                        {formatCurrency(
                                          selectedPayment.booking_total -
                                            selectedPayment.amount
                                        )}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashReconciliation;
