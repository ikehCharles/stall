import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

const DEBOUNCE_DELAY = 300; // milliseconds

export function KYCSearchFilter({ filters, onFiltersChange, onReset }: KYCSearchFilterProps) {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const filtersRef = useRef(filters);

  // Keep filtersRef in sync
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Sync local search input with filters when filters change externally (e.g., from URL, reset)
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced search handler - only updates filters after user stops typing
  const handleSearchChange = useCallback((value: string) => {
    // Update local state immediately for responsive UI (no API call)
    setSearchInput(value);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer to update filters after debounce delay
    debounceTimerRef.current = setTimeout(() => {
      const trimmedValue = value.trim();
      // Only update if value changed to avoid unnecessary API calls
      if (trimmedValue !== filtersRef.current.search) {
        onFiltersChange({ ...filtersRef.current, search: trimmedValue });
      }
    }, DEBOUNCE_DELAY);
  }, [onFiltersChange]);

  const updateFilter = (key: keyof KYCFilters, value: string | Date | null) => {
    // For search, use debounced handler; for others, update immediately
    if (key === 'search') {
      handleSearchChange(value as string);
    } else {
      onFiltersChange({ ...filters, [key]: value });
    }
  };

  const handleReset = () => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchInput("");
    onReset();
  };

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
            placeholder="Search by business name, vendor name or email..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
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
          <Button variant="outline" onClick={handleReset}>
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}