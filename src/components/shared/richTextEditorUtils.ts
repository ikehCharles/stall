import { Quill } from "react-quill-new";
import type ReactQuill from "react-quill-new";
import QuillTableBetter from "quill-table-better";

// Register quill-table-better once globally
Quill.register({ "modules/table-better": QuillTableBetter }, true);

// Re-export so consumers don't need to import from react-quill-new directly
export { Quill };

// Re-export table-better keyboard bindings for consumers that need them
export const quillTableBetterKeyboardBindings = QuillTableBetter.keyboardBindings;

// ---------------------------------------------------------------------------
// Helper: load HTML into a Quill editor safely
// Uses updateContents (required for quill-table-better tables to render).
// ---------------------------------------------------------------------------
export function loadHtmlIntoQuill(
  editor: ReturnType<ReactQuill["getEditor"]>,
  html: string,
) {
  editor.setText("");
  const delta = editor.clipboard.convert({ html });
  editor.updateContents(
    delta as Parameters<typeof editor.updateContents>[0],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Quill as any).sources.USER,
  );
  editor.setSelection(0, 0);
}

// ---------------------------------------------------------------------------
// Public handle exposed via RichTextEditor ref
// ---------------------------------------------------------------------------
export interface RichTextEditorHandle {
  /** Get the current editor HTML */
  getHtml: () => string;
  /** Get the underlying Quill editor instance */
  getEditor: () => ReturnType<ReactQuill["getEditor"]> | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface RichTextEditorProps {
  /** HTML to load when the editor mounts */
  initialHtml?: string;
  /** Quill modules config – if omitted, a sensible default is used */
  modules?: Record<string, unknown>;
  /** Extra className applied to the ReactQuill wrapper */
  className?: string;
  /** Called whenever the editor content changes (html string) */
  onChange?: (html: string) => void;
  /** Unique key that, when changed, re-loads `initialHtml` */
  contentKey?: string;
}

// Default toolbar (basic formatting)
export const DEFAULT_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  ["link"],
  ["clean"],
];
