import DOMPurify from "dompurify";

/**
 * Sanitize HTML produced by the Quill rich-text editor.
 *
 * Uses DOMPurify (browser-native) to allow only the tags / attributes
 * the editor can produce (headings, lists, tables, links, images, basic
 * formatting) while stripping scripts, event handlers, etc.
 */

const ALLOWED_TAGS = [
  // headings
  "h1", "h2", "h3", "h4", "h5", "h6",
  // block
  "p", "br", "hr", "blockquote", "pre",
  // lists
  "ul", "ol", "li",
  // inline formatting
  "b", "i", "u", "s", "em", "strong", "strike", "sub", "sup", "span",
  // links & media
  "a", "img",
  // tables (quill-table-better)
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
  // misc
  "div", "section",
];

const ALLOWED_ATTR = [
  // links
  "href", "target", "rel",
  // images
  "src", "alt", "width", "height",
  // tables
  "colspan", "rowspan",
  // general styling
  "class", "style",
];

// Force all <a> tags to open safely in a new tab
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function sanitizeEditorHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
