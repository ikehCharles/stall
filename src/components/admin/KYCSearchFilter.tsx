import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

export interface KYCFilters {
  search: string;
  status: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}

interface KYCSearchFilterProps {
  filters: KYCFilters;
  onFiltersChange: (filters: KYCFilters) => void;
  onReset: () => void;
}

export function KYCSearchFilter({ filters, onFiltersChange, onReset }: KYCSearchFilterProps) {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const updateFilter = (key: keyof KYCFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };


  useEffect(() => {
    const contactEmail = searchParams.get("contactEmail") || "";
    if (contactEmail && contactEmail !== filters.search) {
      onFiltersChange({ ...filters, search: contactEmail });
    }
  }, [filters, onFiltersChange, searchParams]);

  const hasActiveFilters = Boolean(
    filters.search || 
    filters.status !== 'all' || 
    filters.dateFrom || 
    filters.dateTo
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by business name or email..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Filters */}
        <div className="flex gap-2">
          <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full md:w-40 justify-start text-left font-normal",
                  !filters.dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, "MMM d, y") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom || undefined}
                onSelect={(date) => {
                  updateFilter('dateFrom', date || null);
                  setDateFromOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full md:w-40 justify-start text-left font-normal",
                  !filters.dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(filters.dateTo, "MMM d, y") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo || undefined}
                onSelect={(date) => {
                  updateFilter('dateTo', date || null);
                  setDateToOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button variant="outline" onClick={onReset}>
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}