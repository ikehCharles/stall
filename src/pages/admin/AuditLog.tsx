import { useState, useMemo, useEffect, useRef } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/shared/PaginationControls";
import {
  ClipboardList,
  Search,
  Calendar,
  Eye,
  ArrowLeft,
  Users,
  RotateCcw,
} from "lucide-react";
import {
  useAllAuditLog,
  useAuditLogActions,
  AuditLogEntry,
  AuditLogFilters,
} from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { Link } from "react-router-dom";

/* ── helpers ── */

const actionLabel = (action: string) =>
  action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const getActionBadge = (action: string) => {
  if (action.includes("cancel"))
    return <Badge variant="destructive">{actionLabel(action)}</Badge>;
  if (action.includes("approve") || action.includes("completed"))
    return (
      <Badge className="bg-green-100 text-green-800">
        {actionLabel(action)}
      </Badge>
    );
  if (action.includes("request"))
    return (
      <Badge className="bg-yellow-100 text-yellow-800">
        {actionLabel(action)}
      </Badge>
    );
  if (action.includes("reject"))
    return (
      <Badge className="bg-red-100 text-red-800">
        {actionLabel(action)}
      </Badge>
    );
  return <Badge variant="outline">{actionLabel(action)}</Badge>;
};

const AuditLog = () => {
  /* ── Filter state ── */
  const [filters, setFilters] = useState<AuditLogFilters>({
    search: "",
    action: "all",
    tableName: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        setCurrentPage(1);
        return { ...prev, search: searchInput };
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading } = useAllAuditLog(filters, currentPage, pageSize);
  const { data: actions = [] } = useAuditLogActions();

  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  /* ── Derived: unique table names from current page (for filter dropdown) ── */
  const tableNames = useMemo(
    () => [...new Set(entries.map((e) => e.table_name))].sort(),
    [entries]
  );

  /* ── Summary cards ── */
  const stats = useMemo(
    () => ({
      total: totalCount,
      onPage: entries.length,
      uniqueActors: new Set(entries.map((e) => e.performed_by).filter(Boolean))
        .size,
    }),
    [totalCount, entries]
  );

  const handleFilterChange = (patch: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters({
      search: "",
      action: "all",
      tableName: "all",
      dateFrom: "",
      dateTo: "",
    });
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-600 mt-1">
            Full history of system actions — cancellations, refunds, status changes
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Entries</p>
              <p className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-7 w-16" /> : stats.total}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-muted-foreground">Showing on Page</p>
              <p className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-7 w-16" /> : stats.onPage}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Search className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Unique Actors</p>
              <p className="text-2xl font-bold">
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  stats.uniqueActors
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Action, reason, or record ID…"
                  className="pl-8"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Action</Label>
              <Select
                value={filters.action}
                onValueChange={(v) => handleFilterChange({ action: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {actionLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Table</Label>
              <Select
                value={filters.tableName}
                onValueChange={(v) => handleFilterChange({ tableName: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {tableNames.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  handleFilterChange({ dateFrom: e.target.value })
                }
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    handleFilterChange({ dateTo: e.target.value })
                  }
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="mt-5"
                onClick={resetFilters}
                aria-label="Reset filters"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No audit log entries found.
            </p>
          ) : (
            <>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(Number(newSize));
                  setCurrentPage(1);
                }}
              />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead className="hidden md:table-cell">
                      From → To
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Performed By
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      Reason
                    </TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(
                          new Date(entry.created_at),
                          "dd MMM yyyy HH:mm"
                        )}
                      </TableCell>
                      <TableCell>{getActionBadge(entry.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.table_name}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {entry.from_status || "–"}{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        {entry.to_status || "–"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {entry.performer?.full_name || "System"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm max-w-[200px] truncate">
                        {entry.reason || "–"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelected(entry)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Bottom Pagination */}
              <div className="mt-6">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(Number(newSize));
                    setCurrentPage(1);
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Entry Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Timestamp</span>
                <span>
                  {format(
                    new Date(selected.created_at),
                    "dd MMM yyyy HH:mm:ss"
                  )}
                </span>

                <span className="text-muted-foreground">Action</span>
                <span>{getActionBadge(selected.action)}</span>

                <span className="text-muted-foreground">Table</span>
                <span>
                  <Badge variant="outline">{selected.table_name}</Badge>
                </span>

                <span className="text-muted-foreground">Record ID</span>
                <span className="font-mono text-xs break-all">
                  {selected.record_id}
                </span>

                <span className="text-muted-foreground">From Status</span>
                <span>{selected.from_status || "–"}</span>

                <span className="text-muted-foreground">To Status</span>
                <span>{selected.to_status || "–"}</span>

                <span className="text-muted-foreground">Performed By</span>
                <span>{selected.performer?.full_name || "System"}</span>

                <span className="text-muted-foreground">Reason</span>
                <span>{selected.reason || "–"}</span>
              </div>

              {selected.metadata &&
                Object.keys(selected.metadata).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Metadata</p>
                    <pre className="bg-gray-50 rounded-md p-3 text-xs overflow-auto max-h-48">
                      {JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLog;
