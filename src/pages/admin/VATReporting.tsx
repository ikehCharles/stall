import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirmDialog";
import {
  useVatPeriods,
  useVatLedgerByPeriod,
  useVatLedgerCount,
  useCreateVatPeriod,
  useUpdateVatPeriod,
  useDeleteVatPeriod,
  useReconcileVatPeriod,
  VatPeriod,
} from "@/hooks/useVat";
import CurrencyWrapper from "@/components/shared/currency";
import { format, addDays } from "date-fns";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");
const today = () => toDateStr(new Date());
const tomorrow = (base: string) => toDateStr(addDays(new Date(base), 1));

const getLedgerStatusBadge = (status: string) => {
  switch (status) {
    case "outstanding":
      return <Badge variant="outline" className="border-yellow-500 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Outstanding</Badge>;
    case "collected":
      return <Badge variant="outline" className="border-green-500 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Collected</Badge>;
    case "settled":
      return <Badge variant="outline" className="border-blue-500 text-blue-700"><Lock className="h-3 w-3 mr-1" />Settled</Badge>;
    case "refunded":
      return <Badge variant="outline" className="border-red-500 text-red-700"><RotateCcw className="h-3 w-3 mr-1" />Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getPeriodStatusBadge = (status: string) => {
  if (status === "open") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><Unlock className="h-3 w-3 mr-1" />Open</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100"><Lock className="h-3 w-3 mr-1" />Closed</Badge>;
};

// ─── Create Period Dialog ────────────────────────────────────────────────────

const CreatePeriodDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(tomorrow(today()));
  const createPeriod = useCreateVatPeriod();

  // Reset defaults when dialog opens
  useEffect(() => {
    if (open) {
      const t = today();
      setName("");
      setStartDate(t);
      setEndDate(tomorrow(t));
    }
  }, [open]);

  // Sync end date min when start date changes
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    const nextDay = tomorrow(value);
    // If current end date is before or equal to new start date, bump it
    if (endDate <= value) {
      setEndDate(nextDay);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !startDate) {
      toast({
        title: "Validation Error",
        description: "Name and start date are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPeriod.mutateAsync({
        name: name.trim(),
        startDate,
        endDate: endDate || undefined,
      });

      toast({
        title: "VAT Period Created",
        description: `Period "${name}" has been created.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create period.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create VAT Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="periodName">Period Name</Label>
            <Input
              id="periodName"
              placeholder="e.g. March 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                min={today()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={tomorrow(startDate)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createPeriod.isPending}>
            {createPeriod.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Edit Period Dialog ──────────────────────────────────────────────────────

const EditPeriodDialog = ({
  period,
  onClose,
}: {
  period: VatPeriod | null;
  onClose: () => void;
}) => {
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState("");
  const updatePeriod = useUpdateVatPeriod();

  useEffect(() => {
    if (period) {
      setName(period.name);
      setEndDate(period.end_date ?? "");
    }
  }, [period]);

  const handleSubmit = async () => {
    if (!period || !name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updatePeriod.mutateAsync({
        periodId: period.id,
        name: name.trim(),
        endDate: endDate || undefined,
      });

      toast({
        title: "Period Updated",
        description: `Period "${name}" has been updated.`,
      });

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update period.",
        variant: "destructive",
      });
    }
  };

  if (!period) return null;

  return (
    <Dialog open={!!period} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit VAT Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="editName">Period Name</Label>
            <Input
              id="editName"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={period.start_date}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEndDate">End Date</Label>
              <Input
                id="editEndDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={today()}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updatePeriod.isPending}>
            {updatePeriod.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Period Detail (expanded row) ────────────────────────────────────────────

const PeriodDetail = ({
  period,
  onEdit,
  onDelete,
}: {
  period: VatPeriod;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { data: entries, isLoading } = useVatLedgerByPeriod(period.id);
  const { data: ledgerCount = 0 } = useVatLedgerCount(period.id);
  const reconcile = useReconcileVatPeriod();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handleReconcile = async () => {
    const confirmed = await confirm({
      title: "Reconcile & Close Period",
      description: `This will mark all VAT entries in "${period.name}" as settled and close the period. This action cannot be undone. Are you sure?`,
      confirmText: "Close & Reconcile",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    try {
      await reconcile.mutateAsync(period.id);
      toast({
        title: "Period Reconciled",
        description: `VAT period "${period.name}" has been closed and all entries settled.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reconcile period.",
        variant: "destructive",
      });
    }
  };

  const filteredEntries = entries?.filter(
    (e) => statusFilter === "all" || e.status === statusFilter
  );

  return (
    <div className="p-4 bg-gray-50 border-t space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">VAT Collected</p>
            <p className="text-lg font-bold text-green-700">
              <CurrencyWrapper amount={period.total_vat_collected} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">VAT Outstanding</p>
            <p className="text-lg font-bold text-yellow-700">
              <CurrencyWrapper amount={period.total_vat_outstanding} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total VAT Due</p>
            <p className="text-lg font-bold text-blue-700">
              <CurrencyWrapper amount={period.total_vat_due} />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {period.status === "open" && (
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            {ledgerCount === 0 && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
          <Button
            onClick={handleReconcile}
            disabled={reconcile.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {reconcile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Lock className="h-4 w-4 mr-2" />
            Reconcile & Close Period
          </Button>
        </div>
      )}

      {/* Ledger Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Ledger Entries</h4>
          <div className="flex gap-1">
            {["all", "outstanding", "collected", "refunded", "settled"].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEntries && filteredEntries.length > 0 ? (
          <div className="border rounded-lg overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className={entry.refund_of ? "bg-red-50" : ""}>
                    <TableCell className="font-medium text-sm">
                      {entry.invoice_number}
                      {entry.refund_of && <span className="text-xs text-red-500 ml-1">(refund)</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.vendor?.full_name || entry.vendor?.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <CurrencyWrapper amount={entry.net_amount} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      <CurrencyWrapper amount={entry.vat_amount} />
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <CurrencyWrapper amount={entry.gross_amount} />
                    </TableCell>
                    <TableCell>{getLedgerStatusBadge(entry.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No ledger entries {statusFilter !== "all" ? `with status "${statusFilter}"` : ""} in this period.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const VATReporting = () => {
  const { data: periods, isLoading } = useVatPeriods();
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editPeriod, setEditPeriod] = useState<VatPeriod | null>(null);
  const deletePeriod = useDeleteVatPeriod();
  const confirm = useConfirm();

  const handleDelete = async (period: VatPeriod) => {
    const confirmed = await confirm({
      title: "Delete VAT Period",
      description: `Are you sure you want to delete "${period.name}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    try {
      await deletePeriod.mutateAsync(period.id);
      toast({
        title: "Period Deleted",
        description: `VAT period "${period.name}" has been deleted.`,
      });
      if (expandedPeriod === period.id) setExpandedPeriod(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete period.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/admin/reports">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Reporting
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">VAT Reporting</h1>
          <p className="text-gray-600 mt-1">
            Manage VAT periods, review ledger entries, and reconcile
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Period
        </Button>
      </div>

      {/* Summary of current open period */}
      {periods && periods.find((p) => p.status === "open") && (() => {
        const openPeriod = periods.find((p) => p.status === "open")!;
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-5">
                <p className="text-sm text-green-700 font-medium">Current Period VAT Collected</p>
                <p className="text-2xl font-bold text-green-800 mt-1">
                  <CurrencyWrapper amount={openPeriod.total_vat_collected} />
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-5">
                <p className="text-sm text-yellow-700 font-medium">VAT Outstanding</p>
                <p className="text-2xl font-bold text-yellow-800 mt-1">
                  <CurrencyWrapper amount={openPeriod.total_vat_outstanding} />
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-5">
                <p className="text-sm text-blue-700 font-medium">Total VAT Due</p>
                <p className="text-2xl font-bold text-blue-800 mt-1">
                  <CurrencyWrapper amount={openPeriod.total_vat_due} />
                </p>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Periods Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>VAT Periods</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : periods && periods.length > 0 ? (
            <div>
              {periods.map((period) => (
                <div key={period.id}>
                  <div
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer border-b transition-colors"
                    onClick={() =>
                      setExpandedPeriod(
                        expandedPeriod === period.id ? null : period.id
                      )
                    }
                  >
                    <div className="flex items-center gap-4">
                      {expandedPeriod === period.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{period.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(period.start_date), "MMM d, yyyy")}
                          {" — "}
                          {period.end_date
                            ? format(new Date(period.end_date), "MMM d, yyyy")
                            : "Open-ended"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">VAT Due</p>
                        <p className="font-medium">
                          <CurrencyWrapper amount={period.total_vat_due} />
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Collected</p>
                        <p className="font-medium text-green-700">
                          <CurrencyWrapper amount={period.total_vat_collected} />
                        </p>
                      </div>
                      {getPeriodStatusBadge(period.status)}
                    </div>
                  </div>
                  {expandedPeriod === period.id && (
                    <PeriodDetail
                      period={period}
                      onEdit={() => setEditPeriod(period)}
                      onDelete={() => handleDelete(period)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No VAT periods yet. Create your first period to start tracking VAT.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePeriodDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      <EditPeriodDialog
        period={editPeriod}
        onClose={() => setEditPeriod(null)}
      />
    </div>
  );
};

export default VATReporting;
