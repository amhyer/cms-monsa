/**
 * HTML sanitizer for user-supplied rich-text content (news articles).
 *
 * Uses sanitize-html — a pure-CommonJS sanitizer that does NOT depend on
 * jsdom. Previous implementation used isomorphic-dompurify (DOMPurify +
 * jsdom) but jsdom's dependency chain (html-encoding-sniffer →
 * @exodus/bytes/encoding-lite) uses require() to load an ESM-only module,
 * breaking on Vercel's Node.js 24 runtime.
 *
 * Security model:
 * - Conservative allow-list of tags; strip everything else.
 * - Per-tag attribute allow-list.
 * - Drop event handlers and unsafe URLs (javascript:, data:, vbscript:).
 * - Force rel="noopener noreferrer" on target="_blank" links.
 *
 * See docs/SECURITY_AUDIT.md finding C1 for history.
 */

import sanitize from "sanitize-html";

/** Tags allowed in sanitized content. */
const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike",
  "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
];

/** Per-tag attribute allow-list. */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  span: ["style"],
  div: ["style"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

/**
 * Sanitize an HTML string, stripping disallowed tags, attributes, event
 * handlers, and unsafe URLs. Safe on both server (Node) and browser.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return sanitize(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "ftp", "tel", "file", "sms"],
    // Force rel="noopener noreferrer" on all links with target="_blank"
    transformTags: {
      a: (tagName, attribs) => {
        const attrs = { ...attribs };
        // Only allow target="_blank"; strip all other target values
        if (attrs.target && attrs.target !== "_blank") {
          delete attrs.target;
        }
        if (attrs.target === "_blank") {
          attrs.rel = "noopener noreferrer";
        }
        return { tagName, attribs: attrs };
      },
    },
    // Strip style values that aren't in our safe list
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        "padding": [/.*/],
        "margin": [/.*/],
        "font-weight": [/.*/],
        "font-style": [/.*/],
        "color": [/.*/],
        "background-color": [/.*/],
      },
    },
    // Disallow all classes and IDs
    allowedClasses: {},
  });
}
