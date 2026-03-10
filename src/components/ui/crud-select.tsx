import * as React from "react";
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "@/components/ui/color-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────
export interface CrudSelectOption {
  id: string;
  name: string;
  color: string | null;
}

interface CrudSelectProps {
  /** Currently selected option id (single-select) */
  value: string | null;
  /** All available options */
  options: CrudSelectOption[];
  /** Fires when user picks an option */
  onChange: (id: string | null) => void;
  /** CRUD callbacks – if omitted the action is hidden */
  onCreate?: (name: string, color: string) => Promise<void> | void;
  onUpdate?: (id: string, name: string, color: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Show a "None" option to clear the selection (default true) */
  clearable?: boolean;
}

// ─── Defaults ───────────────────────────────────────────────
const DEFAULT_COLOR = "#6b7280";

// ─── Component ──────────────────────────────────────────────
export function CrudSelect({
  value,
  options,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  placeholder = "Select…",
  disabled = false,
  className,
  clearable = true,
}: CrudSelectProps) {
  const [open, setOpen] = React.useState(false);

  // inline-form state
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState(DEFAULT_COLOR);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState(DEFAULT_COLOR);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  function resetForms() {
    setCreating(false);
    setNewName("");
    setNewColor(DEFAULT_COLOR);
    setEditingId(null);
    setDeletingId(null);
  }

  // ── Create ──────────────────────────────────────────────
  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await onCreate?.(trimmed, newColor);
      toast({ title: "Created", description: `"${trimmed}" added.` });
      setCreating(false);
      setNewName("");
      setNewColor(DEFAULT_COLOR);
    } catch {
      toast({ title: "Error", description: "Failed to create option.", variant: "destructive" });
    }
  }

  // ── Update ──────────────────────────────────────────────
  async function handleUpdate(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await onUpdate?.(id, trimmed, editColor);
      toast({ title: "Updated", description: `"${trimmed}" saved.` });
      setEditingId(null);
    } catch {
      toast({ title: "Error", description: "Failed to update option.", variant: "destructive" });
    }
  }

  // ── Delete ──────────────────────────────────────────────
  async function handleDelete(id: string) {
    const opt = options.find((o) => o.id === id);
    try {
      await onDelete?.(id);
      if (value === id) onChange(null);
      toast({ title: "Deleted", description: `"${opt?.name}" removed.` });
      setDeletingId(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete option.", variant: "destructive" });
    }
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForms(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left ring-offset-background",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              selected.name
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {clearable && selected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                className="rounded-sm p-0.5 opacity-50 hover:opacity-100 hover:bg-muted transition-colors"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {options.length === 0 && !creating && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No options yet.</p>
            )}

            {clearable && value !== null && options.length > 0 && (
              <div
                className="flex items-center gap-2 rounded px-3 py-2 cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => { onChange(null); setOpen(false); resetForms(); }}
              >
                <span className="flex-1 truncate italic">None</span>
              </div>
            )}

            {options.map((opt) => {
              // ── Delete confirmation row
              if (deletingId === opt.id) {
                return (
                  <div key={opt.id} className="flex items-center gap-2 rounded px-3 py-2 bg-destructive/10 border border-destructive/30">
                    <span className="flex-1 text-xs text-destructive truncate">Delete "{opt.name}"?</span>
                    <button type="button" onClick={() => handleDelete(opt.id)} className="text-destructive hover:text-destructive/80" aria-label="Confirm delete">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeletingId(null)} className="text-muted-foreground hover:text-foreground" aria-label="Cancel delete">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              // ── Inline edit row
              if (editingId === opt.id) {
                return (
                  <div key={opt.id} className="flex items-center gap-2 rounded px-3 py-2 bg-muted/50 border border-border">
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(opt.id)}
                      className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                      placeholder="Name"
                    />
                    <button type="button" onClick={() => handleUpdate(opt.id)} className="text-emerald-500 hover:text-emerald-400" aria-label="Save edit">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground" aria-label="Cancel edit">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              // ── Normal option row
              return (
                <div
                  key={opt.id}
                  className={cn(
                    "group flex items-center gap-2 rounded px-3 py-2 cursor-pointer transition-colors",
                    value === opt.id
                      ? "bg-accent text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => {
                    onChange(opt.id === value ? null : opt.id);
                    setOpen(false);
                    resetForms();
                  }}
                >
                  <span className="flex-1 truncate">{opt.name}</span>

                  {/* Hover actions */}
                  <span className="hidden items-center gap-1 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                    {onUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(opt.id);
                          setEditName(opt.name);
                          setEditColor(opt.color || DEFAULT_COLOR);
                          setDeletingId(null);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Edit ${opt.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => { setDeletingId(opt.id); setEditingId(null); }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${opt.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* ── Create row ──────────────────────────────── */}
        {onCreate && (
          <div className="border-t border-border p-1">
            {creating ? (
              <div className="flex items-center gap-2 rounded px-3 py-2 bg-muted/50">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                  placeholder="New option name"
                />
                <button type="button" onClick={handleCreate} className="text-emerald-500 hover:text-emerald-400" aria-label="Create option">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => { setCreating(false); setNewName(""); setNewColor(DEFAULT_COLOR); }} className="text-muted-foreground hover:text-foreground" aria-label="Cancel create">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New option</span>
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Multi-select variant ───────────────────────────────────
interface CrudMultiSelectProps {
  /** Currently selected option ids */
  value: string[];
  options: CrudSelectOption[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string, color: string) => Promise<void> | void;
  onUpdate?: (id: string, name: string, color: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CrudMultiSelect({
  value,
  options,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  placeholder = "Select tags…",
  disabled = false,
  className,
}: CrudMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState(DEFAULT_COLOR);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState(DEFAULT_COLOR);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const selectedOptions = options.filter((o) => value.includes(o.id));

  function resetForms() {
    setCreating(false);
    setNewName("");
    setNewColor(DEFAULT_COLOR);
    setEditingId(null);
    setDeletingId(null);
  }

  function toggleOption(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await onCreate?.(trimmed, newColor);
      toast({ title: "Created", description: `"${trimmed}" added.` });
      setCreating(false);
      setNewName("");
      setNewColor(DEFAULT_COLOR);
    } catch {
      toast({ title: "Error", description: "Failed to create tag.", variant: "destructive" });
    }
  }

  async function handleUpdate(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await onUpdate?.(id, trimmed, editColor);
      toast({ title: "Updated", description: `"${trimmed}" saved.` });
      setEditingId(null);
    } catch {
      toast({ title: "Error", description: "Failed to update tag.", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    const opt = options.find((o) => o.id === id);
    try {
      await onDelete?.(id);
      onChange(value.filter((v) => v !== id));
      toast({ title: "Deleted", description: `"${opt?.name}" removed.` });
      setDeletingId(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete tag.", variant: "destructive" });
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForms(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left ring-offset-background min-h-10",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex flex-1 items-center gap-1.5 flex-wrap min-h-[20px]">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((opt) => (
                <span key={opt.id} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  <Dot color={opt.color} size="sm" />
                  {opt.name}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {options.length === 0 && !creating && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No tags yet.</p>
            )}

            {options.map((opt) => {
              if (deletingId === opt.id) {
                return (
                  <div key={opt.id} className="flex items-center gap-2 rounded px-3 py-2 bg-destructive/10 border border-destructive/30">
                    <span className="flex-1 text-xs text-destructive truncate">Delete "{opt.name}"?</span>
                    <button type="button" onClick={() => handleDelete(opt.id)} className="text-destructive hover:text-destructive/80"><Check className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setDeletingId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                );
              }

              if (editingId === opt.id) {
                return (
                  <div key={opt.id} className="flex items-center gap-2 rounded px-3 py-2 bg-muted/50 border border-border">
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(opt.id)}
                      className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                      placeholder="Name"
                    />
                    <button type="button" onClick={() => handleUpdate(opt.id)} className="text-emerald-500 hover:text-emerald-400"><Check className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                );
              }

              const isSelected = value.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  className={cn(
                    "group flex items-center gap-2 rounded px-3 py-2 cursor-pointer transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => toggleOption(opt.id)}
                >
                  <span className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected ? "border-primary bg-primary/20" : "border-input",
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-primary" />}
                  </span>
                  <Dot color={opt.color} />
                  <span className="flex-1 truncate">{opt.name}</span>

                  <span className="hidden items-center gap-1 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                    {onUpdate && (
                      <button type="button" onClick={() => { setEditingId(opt.id); setEditName(opt.name); setEditColor(opt.color || DEFAULT_COLOR); setDeletingId(null); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                    )}
                    {onDelete && (
                      <button type="button" onClick={() => { setDeletingId(opt.id); setEditingId(null); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {onCreate && (
          <div className="border-t border-border p-1">
            {creating ? (
              <div className="flex items-center gap-2 rounded px-3 py-2 bg-muted/50">
                <ColorPicker value={newColor} onChange={setNewColor} />
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                  placeholder="New tag name"
                />
                <button type="button" onClick={handleCreate} className="text-emerald-500 hover:text-emerald-400"><Check className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => { setCreating(false); setNewName(""); setNewColor(DEFAULT_COLOR); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New tag</span>
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function Dot({ color, size = "md" }: { color: string | null; size?: "sm" | "md" }) {
  return (
    <span
      className={cn("shrink-0 rounded-full", size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5")}
      style={{ backgroundColor: color || DEFAULT_COLOR }}
    />
  );
}
