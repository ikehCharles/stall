import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useEmailTemplates,
  useUpdateEmailTemplate,
  useCreateEmailTemplate,
  type EmailTemplate,
} from "@/hooks/useEmailTemplates";
import { Save, Plus, Mail, Eye, Code, FileText, Palette, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Phone-frame preview
// ---------------------------------------------------------------------------

function PhonePreview({ html, className }: { html: string; className?: string }) {
  return (
    <div className={cn("flex items-start justify-center", className)}>
      <div className="relative mx-auto" style={{ width: 280 }}>
        {/* Phone frame */}
        <div className="rounded-[2rem] border-[3px] border-gray-800 bg-gray-800 shadow-xl overflow-hidden">
          {/* Notch */}
          <div className="flex justify-center pt-1.5 pb-1 bg-gray-800">
            <div className="w-20 h-4 bg-gray-900 rounded-full" />
          </div>
          {/* Screen */}
          <div className="bg-white" style={{ height: 480 }}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-gray-50">
              <Smartphone className="h-3 w-3 text-gray-400" />
              <span className="text-[10px] text-gray-500 font-medium">Email Preview</span>
            </div>
            <iframe
              title="Phone email preview"
              className="w-full border-0"
              style={{ height: 456 }}
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box;max-width:100%}body{margin:0;padding:0;background:#fff;overflow-x:hidden;word-wrap:break-word;overflow-wrap:break-word}.ql-align-center{text-align:center}.ql-align-right{text-align:right}.ql-align-justify{text-align:justify}.ql-indent-1{padding-left:3em}.ql-indent-2{padding-left:6em}table{border-collapse:collapse;max-width:100%}th{border:1px solid #000;padding:2px 5px;background:rgba(0,0,0,.05)}td{border:1px solid #000;padding:2px 5px}</style></head><body>${html}</body></html>`}
            />
          </div>
          {/* Home bar */}
          <div className="flex justify-center py-1.5 bg-gray-800">
            <div className="w-20 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
import ReactQuill, { Quill } from "react-quill-new";
import type QuillType from "quill";
import "react-quill-new/dist/quill.snow.css";
import QuillTableBetter from "quill-table-better";
import "quill-table-better/dist/quill-table-better.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

Quill.register({ "modules/table-better": QuillTableBetter }, true);

/**
 * Upload an image file to Supabase Storage and return its public URL.
 */
async function uploadImageToSupabase(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const fileName = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("template-assets")
    .upload(fileName, file, { upsert: false, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from("template-assets").getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * quill-table-better requires updateContents() instead of setContents()
 * for tables to render. This helper loads HTML into a Quill editor safely.
 */
function loadHtmlIntoQuill(editor: QuillType, html: string) {
  editor.setText("");
  const delta = editor.clipboard.convert({ html });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor.updateContents(delta as Parameters<typeof editor.updateContents>[0], (Quill as any).sources.USER);
  editor.setSelection(0, 0);
}

// ---------------------------------------------------------------------------
// Wrapper Editor — simplified form for the header/footer template
// ---------------------------------------------------------------------------

type ColorMode = "gradient" | "solid" | "none";
type Align = "left" | "center" | "right";

interface WrapperConfig {
  headerText: string;
  headerAlign: Align;
  headerColorMode: ColorMode;
  headerColor1: string;
  headerColor2: string;
  headerTextColor: string;
  footerText: string;
  footerAlign: Align;
  footerColorMode: ColorMode;
  footerColor1: string;
  footerColor2: string;
  footerTextColor: string;
}

function parseWrapper(html: string): WrapperConfig {
  const headerText = html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1] || "StallBook";

  const headerAlignMatch = html.match(/<div[^>]*?(?:text-align:\s*(left|center|right))[^>]*>[\s\S]*?<h1/);
  const headerAlign = (headerAlignMatch?.[1] as Align) || "center";

  const gradientMatch = html.match(/background:\s*linear-gradient\(135deg,\s*(#[0-9a-fA-F]{3,8})\s+0%,\s*(#[0-9a-fA-F]{3,8})\s+100%\)/);
  const solidBgMatch = !gradientMatch && html.match(/<div[^>]*?background:\s*(#[0-9a-fA-F]{3,8})[^;)]*;[^>]*>[\s\S]*?<h1/);
  let headerColorMode: ColorMode = "gradient";
  let headerColor1 = "#3b82f6";
  let headerColor2 = "#8b5cf6";
  if (gradientMatch) {
    headerColor1 = gradientMatch[1];
    headerColor2 = gradientMatch[2];
  } else if (solidBgMatch) {
    headerColorMode = "solid";
    headerColor1 = solidBgMatch[1];
  } else if (html.match(/<div[^>]*background:\s*(?:none|transparent)/)) {
    headerColorMode = "none";
  }

  const headerTextColorMatch = html.match(/<h1[^>]*color:\s*(#[0-9a-fA-F]{3,8})/);
  const headerTextColor = headerTextColorMatch?.[1] || "#ffffff";

  // Footer
  const footerBlockMatch = html.match(/<div[^>]*border-top[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*$/);
  const footerBlock = footerBlockMatch?.[1] || "";
  const footerPMatch = footerBlock.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const footerText = footerPMatch?.[1]?.trim() || "This is an automated notification from StallBook. Please do not reply to this email.";

  const footerAlignMatch = footerBlock.match(/text-align:\s*(left|center|right)/) || html.match(/<div[^>]*border-top[^>]*text-align:\s*(left|center|right)/);
  const footerAlign = (footerAlignMatch?.[1] as Align) || "center";

  const footerGradientMatch = html.match(/<div[^>]*border-top[^>]*background:\s*linear-gradient\(135deg,\s*(#[0-9a-fA-F]{3,8})\s+0%,\s*(#[0-9a-fA-F]{3,8})\s+100%\)/);
  const footerSolidMatch = !footerGradientMatch && html.match(/<div[^>]*border-top[^>]*background:\s*(#[0-9a-fA-F]{3,8})/);
  let footerColorMode: ColorMode = "none";
  let footerColor1 = "#6b7280";
  let footerColor2 = "#374151";
  if (footerGradientMatch) {
    footerColorMode = "gradient";
    footerColor1 = footerGradientMatch[1];
    footerColor2 = footerGradientMatch[2];
  } else if (footerSolidMatch) {
    footerColorMode = "solid";
    footerColor1 = footerSolidMatch[1];
  }

  const footerTextColorMatch = footerBlock.match(/<p[^>]*color:\s*(#[0-9a-fA-F]{3,8})/);
  const footerTextColor = footerTextColorMatch?.[1] || "#9ca3af";

  return { headerText, headerAlign, headerColorMode, headerColor1, headerColor2, headerTextColor, footerText, footerAlign, footerColorMode, footerColor1, footerColor2, footerTextColor };
}

function buildWrapper(c: WrapperConfig) {
  const headerBg =
    c.headerColorMode === "gradient" ? `background: linear-gradient(135deg, ${c.headerColor1} 0%, ${c.headerColor2} 100%);`
    : c.headerColorMode === "solid" ? `background: ${c.headerColor1};`
    : "";
  const footerBg =
    c.footerColorMode === "gradient" ? `background: linear-gradient(135deg, ${c.footerColor1} 0%, ${c.footerColor2} 100%);`
    : c.footerColorMode === "solid" ? `background: ${c.footerColor1};`
    : "";

  return `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="${headerBg} padding: 32px 24px; text-align: ${c.headerAlign};">
    <h1 style="color: ${c.headerTextColor}; margin: 0; font-size: 24px; font-weight: 700;">${c.headerText}</h1>
  </div>
  <div style="padding: 32px 24px;">
    {{content}}
  </div>
  <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; text-align: ${c.footerAlign}; ${footerBg}">
    <p style="color: ${c.footerTextColor}; font-size: 12px; margin: 0;">
      ${c.footerText}
    </p>
  </div>
</div>`;
}

// Shared alignment picker
function AlignPicker({ value, onChange }: { value: Align; onChange: (v: Align) => void }) {
  const opts: { val: Align; label: string }[] = [
    { val: "left", label: "Left" },
    { val: "center", label: "Center" },
    { val: "right", label: "Right" },
  ];
  return (
    <div className="flex items-center rounded-md border bg-gray-50 p-0.5 w-fit">
      {opts.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded transition-colors",
            value === o.val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Shared color mode picker
function ColorModePicker({ value, onChange, showGradient = true }: { value: ColorMode; onChange: (v: ColorMode) => void; showGradient?: boolean }) {
  const opts: { val: ColorMode; label: string }[] = [
    ...(showGradient ? [{ val: "gradient" as ColorMode, label: "Gradient" }] : []),
    { val: "solid", label: "Solid" },
    { val: "none", label: "None" },
  ];
  return (
    <div className="flex items-center rounded-md border bg-gray-50 p-0.5 w-fit">
      {opts.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded transition-colors",
            value === o.val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded border cursor-pointer p-0.5" />
      <div>
        <p className="text-[11px] text-gray-500">{label}</p>
        <p className="text-xs font-mono text-gray-700">{value}</p>
      </div>
    </div>
  );
}

function WrapperEditor({
  template,
  onSave,
  isSaving,
}: {
  template: EmailTemplate;
  onSave: (subject: string, htmlBody: string) => void;
  isSaving: boolean;
}) {
  const parsed = parseWrapper(template.html_body);
  const [cfg, setCfg] = useState<WrapperConfig>(parsed);
  const set = <K extends keyof WrapperConfig>(key: K, val: WrapperConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    setCfg(parseWrapper(template.html_body));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  const currentHtml = buildWrapper(cfg);

  const sampleBody = `<h2 style="color:#1f2937;margin:0 0 8px;">Sample Email Title</h2>
<p style="color:#6b7280;margin:0 0 20px;">This is a preview of how your emails will look with the current header and footer.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;color:#374151;width:40%;font-size:14px;">Field</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#1f2937;font-size:14px;">Value</td></tr>
</table>`;

  const previewHtml = currentHtml.replace("{{content}}", sampleBody);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Left: form */}
        <ScrollArea className="pr-2">
          <div className="space-y-5">
            {/* Header section */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Header
                </h3>

                <div className="space-y-1.5">
                  <Label className="text-sm">Header Text</Label>
                  <Input value={cfg.headerText} onChange={(e) => set("headerText", e.target.value)} placeholder="e.g. StallBook" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Alignment</Label>
                  <AlignPicker value={cfg.headerAlign} onChange={(v) => set("headerAlign", v)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Background</Label>
                  <ColorModePicker value={cfg.headerColorMode} onChange={(v) => set("headerColorMode", v)} />
                  {cfg.headerColorMode === "gradient" && (
                    <div className="flex items-center gap-3 mt-2">
                      <ColorInput value={cfg.headerColor1} onChange={(v) => set("headerColor1", v)} label="Start" />
                      <div className="w-10 h-5 rounded-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${cfg.headerColor1}, ${cfg.headerColor2})` }} />
                      <ColorInput value={cfg.headerColor2} onChange={(v) => set("headerColor2", v)} label="End" />
                    </div>
                  )}
                  {cfg.headerColorMode === "solid" && (
                    <div className="mt-2">
                      <ColorInput value={cfg.headerColor1} onChange={(v) => set("headerColor1", v)} label="Color" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Text Color</Label>
                  <ColorInput value={cfg.headerTextColor} onChange={(v) => set("headerTextColor", v)} label="Color" />
                </div>
              </CardContent>
            </Card>

            {/* Footer section */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Footer
                </h3>

                <div className="space-y-1.5">
                  <Label className="text-sm">Footer Text</Label>
                  <textarea
                    value={cfg.footerText}
                    onChange={(e) => set("footerText", e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Footer disclaimer text..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Alignment</Label>
                  <AlignPicker value={cfg.footerAlign} onChange={(v) => set("footerAlign", v)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Background</Label>
                  <ColorModePicker value={cfg.footerColorMode} onChange={(v) => set("footerColorMode", v)} />
                  {cfg.footerColorMode === "gradient" && (
                    <div className="flex items-center gap-3 mt-2">
                      <ColorInput value={cfg.footerColor1} onChange={(v) => set("footerColor1", v)} label="Start" />
                      <div className="w-10 h-5 rounded-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${cfg.footerColor1}, ${cfg.footerColor2})` }} />
                      <ColorInput value={cfg.footerColor2} onChange={(v) => set("footerColor2", v)} label="End" />
                    </div>
                  )}
                  {cfg.footerColorMode === "solid" && (
                    <div className="mt-2">
                      <ColorInput value={cfg.footerColor1} onChange={(v) => set("footerColor1", v)} label="Color" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Text Color</Label>
                  <ColorInput value={cfg.footerTextColor} onChange={(v) => set("footerTextColor", v)} label="Color" />
                </div>
              </CardContent>
            </Card>

            <Button
              className="gap-1.5"
              onClick={() => onSave(template.subject, currentHtml)}
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Wrapper"}
            </Button>
          </div>
        </ScrollArea>

        {/* Right: live preview */}
        <div className="flex flex-col min-h-0">
          <p className="text-xs font-medium text-gray-500 mb-2">Live Preview</p>
          <PhonePreview html={previewHtml} className="flex-1 overflow-auto py-2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Find the {{variable}} surrounding a cursor index, if any.
 * Returns [start, end] of the full {{...}} token or null.
 */
function findVariableAt(text: string, index: number): [number, number] | null {
  const pattern = /\{\{[^}]+\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (index > start && index <= end) return [start, end];
  }
  return null;
}

// Keyboard handler that deletes entire {{variable}} on Backspace / Delete
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function variableDeleteHandler(this: any, range: { index: number; length: number }, _ctx: unknown, isForward: boolean) {
  const quill = this.quill;
  if (range.length > 0) return true;
  const text: string = quill.getText();
  const idx = isForward ? range.index + 1 : range.index;
  const bounds = findVariableAt(text, idx);
  if (bounds) {
    quill.deleteText(bounds[0], bounds[1] - bounds[0], Quill.sources.USER);
    quill.setSelection(bounds[0], 0, Quill.sources.SILENT);
    return false;
  }
  return true;
}

// Quill toolbar layout (static — same for all editors)
const QUILL_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  ["table-better"],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

const QUILL_KEYBOARD_BINDINGS = {
  ...QuillTableBetter.keyboardBindings,
  variableBackspace: {
    key: "Backspace",
    handler: function (this: unknown, range: { index: number; length: number }, ctx: unknown) {
      return variableDeleteHandler.call(this, range, ctx, false);
    },
  },
  variableDelete: {
    key: "Delete",
    handler: function (this: unknown, range: { index: number; length: number }, ctx: unknown) {
      return variableDeleteHandler.call(this, range, ctx, true);
    },
  },
};

// ---------------------------------------------------------------------------
// Template Editor
// ---------------------------------------------------------------------------

function TemplateEditor({
  template,
  wrapperHtml,
  onSave,
  isSaving,
}: {
  template: EmailTemplate;
  wrapperHtml: string | null;
  onSave: (subject: string, htmlBody: string) => void;
  isSaving: boolean;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [mode, setMode] = useState<"wysiwyg" | "html">("wysiwyg");
  const [htmlSource, setHtmlSource] = useState(template.html_body);
  const [uploading, setUploading] = useState(false);
  const quillRef = useRef<ReactQuill>(null);
  const needsLoad = useRef(true);
  const pendingHtml = useRef(template.html_body);
  const { toast } = useToast();

  // Build modules once (stable ref so Quill doesn't re-init on every render)
  const quillModules = useMemo(() => ({
    table: false,
    toolbar: {
      container: QUILL_TOOLBAR,
      handlers: {
        image: function () {
          const input = document.createElement("input");
          input.setAttribute("type", "file");
          input.setAttribute("accept", "image/*");
          input.click();
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const editor = quillRef.current?.getEditor();
            if (!editor) return;
            const range = editor.getSelection(true);
            try {
              setUploading(true);
              const url = await uploadImageToSupabase(file);
              editor.insertEmbed(range.index, "image", url, Quill.sources.USER);
              editor.setSelection(range.index + 1, 0, Quill.sources.SILENT);
            } catch (err) {
              toast({
                title: "Image upload failed",
                description: err instanceof Error ? err.message : "Could not upload image",
                variant: "destructive",
              });
            } finally {
              setUploading(false);
            }
          };
        },
      },
    },
    "table-better": {
      language: "en_US",
      menus: ["column", "row", "merge", "table", "cell", "wrap", "delete"],
      toolbarTable: true,
    },
    keyboard: {
      bindings: QUILL_KEYBOARD_BINDINGS,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Sync when template changes
  useEffect(() => {
    setSubject(template.subject);
    setHtmlSource(template.html_body);
    pendingHtml.current = template.html_body;
    setMode("wysiwyg");
    needsLoad.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  // Load HTML into Quill via updateContents (required for table-better).
  // Runs on initial mount, template switch, AND when switching back from HTML mode.
  // Uses pendingHtml ref so it's not affected by onChange firing during remount.

  useEffect(() => {
    if (mode !== "wysiwyg") {
      needsLoad.current = true;
      return;
    }
    if (!needsLoad.current) return;
    const timer = setTimeout(() => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return;
      loadHtmlIntoQuill(editor, pendingHtml.current);
      needsLoad.current = false;
    }, 50);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, template.id]);

  const switchMode = (next: "wysiwyg" | "html") => {
    if (mode === "wysiwyg" && next === "html") {
      const editor = quillRef.current?.getEditor();
      if (editor) {
        const html = editor.root.innerHTML;
        setHtmlSource(html);
        pendingHtml.current = html;
      }
    }
    if (mode === "html" && next === "wysiwyg") {
      pendingHtml.current = htmlSource;
    }
    setMode(next);
  };

  const getCurrentHtml = () => {
    if (mode === "wysiwyg") {
      const editor = quillRef.current?.getEditor();
      return editor ? editor.root.innerHTML : htmlSource;
    }
    return htmlSource;
  };

  const getPreviewHtml = () => {
    if (wrapperHtml) {
      return wrapperHtml.replace("{{content}}", htmlSource);
    }
    return htmlSource;
  };

  const insertVariable = (name: string) => {
    if (mode === "wysiwyg") {
      const editor = quillRef.current?.getEditor();
      if (!editor) return;
      const range = editor.getSelection(true);
      editor.insertText(range.index, `{{${name}}}`);
      editor.setSelection(range.index + name.length + 4, 0);
    } else {
      setHtmlSource((prev) => prev + `{{${name}}}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Left: editor */}
        <div className="flex flex-col min-h-0">
          {/* Subject */}
          <div className="space-y-1.5 mb-3">
            <Label htmlFor="subject" className="text-sm font-medium">Email Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line..."
            />
          </div>

          {/* Variables */}
          {template.variables.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1.5">
                Available variables <span className="text-gray-400 font-normal">(click to insert)</span>:
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {template.variables.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="text-xs font-mono cursor-pointer whitespace-nowrap flex-shrink-0 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                    onClick={() => insertVariable(v)}
                  >
                    {"{{" + v + "}}"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex items-center gap-1 mb-2">
            <div className="flex items-center rounded-md border bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => switchMode("wysiwyg")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors",
                  mode === "wysiwyg" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <FileText className="h-3 w-3" />Editor
              </button>
              <button
                type="button"
                onClick={() => switchMode("html")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors",
                  mode === "html" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Code className="h-3 w-3" />HTML
              </button>
            </div>
            {uploading && (
              <span className="text-xs text-blue-600 animate-pulse ml-2">Uploading image...</span>
            )}
          </div>

          {/* Editor area */}
          <Card className="flex-1 min-h-0 overflow-hidden">
            <CardContent className="p-0 h-full">
              {mode === "wysiwyg" && (
                <div className="h-full flex flex-col [&_.ql-toolbar]:flex-shrink-0 [&_.ql-container]:flex-1 [&_.ql-container]:overflow-auto [&_.ql-container]:min-h-0">
                  <ReactQuill
                    key={template.id}
                    ref={quillRef}
                    theme="snow"
                    onChange={(content) => {
                      if (!needsLoad.current) {
                        setHtmlSource(content);
                        pendingHtml.current = content;
                      }
                    }}
                    modules={quillModules}
                    className="h-full flex flex-col"
                  />
                </div>
              )}

              {mode === "html" && (
                <textarea
                  className="w-full h-full p-4 font-mono text-sm resize-none border-0 focus:outline-none focus:ring-0 bg-gray-50"
                  value={htmlSource}
                  onChange={(e) => setHtmlSource(e.target.value)}
                  spellCheck={false}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: live phone preview */}
        <div className="flex flex-col min-h-0">
          <p className="text-xs font-medium text-gray-500 mb-2">Live Preview</p>
          <PhonePreview html={getPreviewHtml()} className="flex-1 overflow-auto py-2" />
        </div>
      </div>

      <Button
        className="gap-1.5 mt-4"
        onClick={() => onSave(subject, getCurrentHtml())}
        disabled={isSaving}
      >
        <Save className="h-4 w-4" />
        {isSaving ? "Saving..." : "Save Template"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Template Dialog
// ---------------------------------------------------------------------------

function NewTemplateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { key: string; name: string; subject: string; html_body: string; variables: string[] }) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");

  const handleSubmit = () => {
    if (!key.trim() || !name.trim()) return;
    onCreate({
      key: key.trim().toLowerCase().replace(/\s+/g, "_"),
      name: name.trim(),
      subject: subject.trim() || name.trim(),
      html_body: "<h2>New Template</h2>\n<p>Edit this template content.</p>",
      variables: [],
    });
    setKey("");
    setName("");
    setSubject("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Email Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Template Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. order_confirmation"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-gray-400">Unique identifier used in code. Lowercase, underscores only.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Order Confirmation" />
          </div>
          <div className="space-y-1.5">
            <Label>Email Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Your order has been confirmed" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!key.trim() || !name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EmailTemplates() {
  const { data: templates, isLoading } = useEmailTemplates();
  const updateTemplate = useUpdateEmailTemplate();
  const createTemplate = useCreateEmailTemplate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  // Auto-select first template
  useEffect(() => {
    if (!selectedId && templates && templates.length > 0) {
      setSelectedId(templates[0].id);
    }
  }, [templates, selectedId]);

  const selectedTemplate = templates?.find((t) => t.id === selectedId) ?? null;
  const wrapperTemplate = templates?.find((t) => t.key === "wrapper") ?? null;
  const isWrapper = selectedTemplate?.key === "wrapper";

  const handleSave = useCallback(
    (subject: string, htmlBody: string) => {
      if (!selectedTemplate) return;
      updateTemplate.mutate({ id: selectedTemplate.id, subject, html_body: htmlBody });
    },
    [selectedTemplate, updateTemplate]
  );

  const handleCreate = useCallback(
    (data: { key: string; name: string; subject: string; html_body: string; variables: string[] }) => {
      createTemplate.mutate(data, {
        onSuccess: (newTpl) => {
          if (newTpl) setSelectedId(newTpl.id);
        },
      });
    },
    [createTemplate]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: dropdown + new button */}
      <div className="flex items-center gap-3 mb-4">
        <Select
          value={selectedId ?? undefined}
          onValueChange={(val) => setSelectedId(val)}
        >
          <SelectTrigger className="w-72 bg-gray-900 text-white border-gray-900 hover:bg-gray-800 [&>svg]:text-white">
            <SelectValue placeholder={isLoading ? "Loading..." : "Select a template"}>
              {selectedTemplate?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {templates?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span>{t.name}</span>
                  <span className="text-[11px] text-gray-400 font-mono ml-1">({t.key})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button className="gap-1.5 flex-shrink-0" onClick={() => setNewDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {selectedTemplate ? (
          isWrapper ? (
            <WrapperEditor
              template={selectedTemplate}
              onSave={handleSave}
              isSaving={updateTemplate.isPending}
            />
          ) : (
            <TemplateEditor
              template={selectedTemplate}
              wrapperHtml={wrapperTemplate?.html_body ?? null}
              onSave={handleSave}
              isSaving={updateTemplate.isPending}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Select a template to edit</p>
            </div>
          </div>
        )}
      </div>

      <NewTemplateDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
