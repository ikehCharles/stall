import { useState } from "react";
import { format, subDays, startOfDay, endOfDay, startOfToday, startOfYesterday, endOfYesterday } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRangeValue {
  start: Date;
  end: Date;
}

interface Preset {
  label: string;
  getValue: () => DateRangeValue;
}

const presets: Preset[] = [
  {
    label: "Today",
    getValue: () => ({
      start: startOfDay(startOfToday()),
      end: endOfDay(new Date()),
    }),
  },
  {
    label: "Yesterday",
    getValue: () => ({
      start: startOfDay(startOfYesterday()),
      end: endOfYesterday(),
    }),
  },
  {
    label: "Last 7 Days",
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 6)),
      end: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 30 Days",
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 29)),
      end: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 90 Days",
    getValue: () => ({
      start: startOfDay(subDays(new Date(), 89)),
      end: endOfDay(new Date()),
    }),
  },
];

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  activePreset: string;
  onPresetChange: (label: string) => void;
}

export const DateRangeFilter = ({
  value,
  onChange,
  activePreset,
  onPresetChange,
}: DateRangeFilterProps) => {
  const [open, setOpen] = useState(false);

  const calendarRange: DateRange = {
    from: value.start,
    to: value.end,
  };

  const handlePreset = (preset: Preset) => {
    onPresetChange(preset.label);
    onChange(preset.getValue());
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      onPresetChange("Custom");
      onChange({
        start: startOfDay(range.from),
        end: range.to ? endOfDay(range.to) : endOfDay(range.from),
      });
      if (range.from && range.to) {
        setOpen(false);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets */}


      {/* Custom date range picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === "Custom" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 text-xs gap-1.5 justify-start font-normal",
              activePreset === "Custom" && "font-medium"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {`${format(value.start, "MMM d")} – ${format(value.end, "MMM d, yyyy")}`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex items-center flex-row-reverse gap-2 overflow-auto w-[250px] md:w-[500px] mx-auto p-2 ">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.label ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            defaultMonth={value.start}
            selected={calendarRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
