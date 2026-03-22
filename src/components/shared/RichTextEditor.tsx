import {
  useRef,
  useEffect,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "quill-table-better/dist/quill-table-better.css";
import {
  loadHtmlIntoQuill,
  DEFAULT_TOOLBAR,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "./richTextEditorUtils";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    { initialHtml = "", modules, className, onChange, contentKey },
    ref,
  ) {
    const quillRef = useRef<ReactQuill>(null);
    const needsLoad = useRef(true);
    const pendingHtml = useRef(initialHtml);

    // Default modules — disable table-better & table unless caller overrides
    const defaultModules = useMemo(
      () => ({
        toolbar: { container: DEFAULT_TOOLBAR },
        "table-better": false,
        table: false,
      }),
      [],
    );

    const resolvedModules = modules ?? defaultModules;

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      getHtml: () => {
        const editor = quillRef.current?.getEditor();
        return editor ? editor.root.innerHTML : pendingHtml.current;
      },
      getEditor: () => quillRef.current?.getEditor() ?? null,
    }));

    // When contentKey changes, flag a re-load
    useEffect(() => {
      pendingHtml.current = initialHtml;
      needsLoad.current = true;
    }, [contentKey, initialHtml]);

    // Load content imperatively after mount / contentKey change
    useEffect(() => {
      if (!needsLoad.current) return;
      const timer = setTimeout(() => {
        const editor = quillRef.current?.getEditor();
        if (!editor) return;
        loadHtmlIntoQuill(editor, pendingHtml.current);
        needsLoad.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }, [contentKey]);

    return (
      <ReactQuill
        ref={quillRef}
        theme="snow"
        onChange={(content) => {
          if (!needsLoad.current) {
            pendingHtml.current = content;
            onChange?.(content);
          }
        }}
        modules={resolvedModules}
        className={className}
      />
    );
  },
);

export default RichTextEditor;
