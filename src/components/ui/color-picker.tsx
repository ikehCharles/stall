import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#78716c", "#6b7280", "#1e293b",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-6 w-6 rounded-full border border-input ring-offset-background transition-colors",
            "hover:ring-2 hover:ring-ring hover:ring-offset-1",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
          )}
          style={{ backgroundColor: value || "#6b7280" }}
          aria-label="Pick a color"
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        sideOffset={8}
      >
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "h-7 w-7 rounded-full border transition-all",
                value === color
                  ? "border-primary ring-2 ring-primary/30 scale-110"
                  : "border-muted-foreground/30 hover:border-muted-foreground hover:scale-110"
              )}
              style={{ backgroundColor: color }}
              onClick={() => {
                onChange(color);
                setOpen(false);
              }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
