import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useStallBookingDates } from "@/hooks/useBookingDates";
import { useStallHolds } from "@/hooks/useStallHolds";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isBefore, startOfToday } from "date-fns";
import { AlertCircle, Info } from "lucide-react";

interface BookingCalendarProps {
  marketId: string;
  stallInstanceId: string;
  marketStartDate: string;
  marketEndDate: string;
  selectedDates: Date[];
  onDateSelect: (dates: Date[]) => void;
  maxDays?: number;
  minDays?: number;
  disabled?: boolean;
}

export function BookingCalendar({
  marketId,
  stallInstanceId,
  marketStartDate,
  marketEndDate,
  selectedDates,
  onDateSelect,
  maxDays = 5,
  minDays = 1,
  disabled = false
}: BookingCalendarProps) {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  
  const { data: bookedDates = [] } = useStallBookingDates(stallInstanceId);
  const { data: stallHoldsData = {} } = useStallHolds(marketId);
  
  const marketStart = parseISO(marketStartDate);
  const marketEnd = parseISO(marketEndDate);

  // Convert booked dates to Date objects
  const bookedDateObjects = bookedDates.map(dateStr => parseISO(dateStr));
  
  // Get dates that are held by others for this specific stall
  const heldDateStrings = stallHoldsData[stallInstanceId] || [];
  const heldDates = heldDateStrings.map(dateStr => parseISO(dateStr));

  const handleDateClick = (date: Date) => {
    if (disabled) return;
    
    const clickedDate = startOfDay(date);
    const isSelected = selectedDates.some(d => 
      startOfDay(d).getTime() === clickedDate.getTime()
    );
    
    if (isSelected) {
      // Remove date
      const newDates = selectedDates.filter(d => 
        startOfDay(d).getTime() !== clickedDate.getTime()
      );
      onDateSelect(newDates);
    } else {
      // Check if limit reached
      if (selectedDates.length >= maxDays) {
        // Show feedback that limit is reached (already handled by UI below)
        return;
      }
      onDateSelect([...selectedDates, clickedDate]);
    }
  };

  const isDayDisabled = (date: Date) => {
    const day = startOfDay(date);
    
    if (isBefore(day, startOfToday())) {
      return true;
    }
    // Outside market period
    if (!isWithinInterval(day, { start: marketStart, end: marketEnd })) {
      return true;
    }
    
    // Already booked
    if (bookedDateObjects.some(bookedDate => 
      startOfDay(bookedDate).getTime() === day.getTime()
    )) {
      return true;
    }
    
    // Held by others
    if (heldDates.some(heldDate => 
      startOfDay(heldDate).getTime() === day.getTime()
    )) {
      return true;
    }
    
    return false;
  };

  const getDayModifiers = (date: Date) => {
    const day = startOfDay(date);
    const isSelected = selectedDates.some(d => 
      startOfDay(d).getTime() === day.getTime()
    );
    const isBooked = bookedDateObjects.some(bookedDate => 
      startOfDay(bookedDate).getTime() === day.getTime()
    );
    const isHeld = heldDates.some(heldDate => 
      startOfDay(heldDate).getTime() === day.getTime()
    );

    return {
      selected: isSelected,
      booked: isBooked,
      held: isHeld,
      disabled: isDayDisabled(date)
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Select Dates</span>
          <div className="text-sm font-normal">
            {selectedDates.length}/{maxDays} days selected
          </div>
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary rounded"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-destructive rounded"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>Held</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-muted rounded"></div>
            <span>Available</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Calendar
          mode="multiple"
          selected={selectedDates}
          onSelect={(dates) => {
            if (dates && dates.length <= maxDays) {
              onDateSelect(dates);
            }
          }}
          disabled={isDayDisabled}
          className={cn("w-full pointer-events-auto")}
          modifiers={{
            booked: (date) => getDayModifiers(date).booked,
            held: (date) => getDayModifiers(date).held,
            selected: (date) => getDayModifiers(date).selected,
          }}
          modifiersStyles={{
            booked: {
              backgroundColor: 'hsl(var(--destructive))',
              color: 'hsl(var(--destructive-foreground))',
            },
            held: {
              backgroundColor: 'hsl(25, 95%, 53%)', // orange-500
              color: 'white',
            },
            selected: {
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
            },
          }}
        />
        
        {selectedDates.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Selected Dates:</h4>
            <div className="flex flex-wrap gap-1">
              {selectedDates.map(date => (
                <Badge key={date.toISOString()} variant="outline">
                  {format(date, 'MMM d')}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {selectedDates.length >= maxDays && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You've reached the maximum of {maxDays} days per booking. To select different dates, first deselect some of your current selections.
            </AlertDescription>
          </Alert>
        )}
        
        {selectedDates.length > 0 && selectedDates.length < maxDays && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              You can select up to {maxDays - selectedDates.length} more day{maxDays - selectedDates.length !== 1 ? 's' : ''}.
            </AlertDescription>
          </Alert>
        )}
        
        {selectedDates.length < minDays && (
          <p className="text-sm text-muted-foreground mt-2">
            Select at least {minDays} day{minDays > 1 ? 's' : ''} to continue.
          </p>
        )}
      </CardContent>
    </Card>
  );
}