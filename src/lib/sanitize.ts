/**
 * HTML sanitizer for user-supplied rich-text content (news articles).
 *
 * Uses DOMPurify via isomorphic-dompurify — the industry-standard XSS
 * sanitizer — which runs the same trusted DOM-parsing logic on the server
 * (jsdom) and in the browser (the package's "browser" export keeps jsdom
 * out of client bundles).
 *
 * This replaces the previous homemade sanitizer whose regex fallback could
 * be bypassed (nested/obfuscated tags, entity-encoded `javascript:`, SVG,
 * etc.). The weak regex path has been removed entirely. See
 * SECURITY_AUDIT.md finding C1.
 *
 * Security model (kept from the previous implementation):
 * - Conservative allow-list of tags; strip everything else.
 * - Per-tag attribute allow-list (enforced via DOMPurify hook, since
 *   DOMPurify's ALLOWED_ATTR is global).
 * - Drop event handlers and unsafe URLs (javascript:, data:, vbscript:, …).
 * - Only safe inline CSS declarations survive on `style`.
 * - Force `rel="noopener noreferrer"` on `target="_blank"` links.
 */

import DOMPurify, {
  type Config,
  type UponSanitizeAttributeHook,
} from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike",
  "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
];

/** Per-tag attribute allow-list — an attribute is only kept on its own tag. */
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "title", "target"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  span: new Set(["style"]),
  div: new Set(["style"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

const ALL_ALLOWED_ATTRS = [
  ...new Set(Object.values(ALLOWED_ATTRS).flatMap((s) => [...s])),
];

// Allow only safe inline styles (text alignment, basic spacing).
const SAFE_STYLE =
  /^(text-align|padding|margin|font-weight|font-style|color|background-color)\s*:/i;

// Block javascript:/data:/vbscript: etc.; allow http(s), mailto, tel, ftp,
// file, sms, relative URLs, and values without a scheme separator.
const SAFE_URI_REGEXP =
  /^(?:(?:https?|mailto|ftp|tel|file|sms):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ALL_ALLOWED_ATTRS,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
};

/**
 * Enforce the per-tag attribute allow-list and filter inline styles to the
 * safe CSS allow-list. DOMPurify removes event handlers and unsafe URLs
 * itself; this hook additionally enforces our per-tag policy.
 */
const uponSanitizeAttribute: UponSanitizeAttributeHook = (node, data) => {
  const tag = (node.tagName ?? "").toLowerCase();
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed || !allowed.has(data.attrName)) {
    data.keepAttr = false;
    return;
  }
  if (data.attrName === "style") {
    const safe = data.attrValue
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d && SAFE_STYLE.test(d))
      .join("; ");
    if (safe) data.attrValue = safe;
    else data.keepAttr = false;
    return;
  }
  if (data.attrName === "target" && data.attrValue !== "_blank") {
    data.keepAttr = false;
  }
};

/** Force rel="noopener noreferrer" on any link that opens in a new tab. */
const afterSanitizeAttributes = (node: Element) => {
  if (
    (node.tagName ?? "").toLowerCase() === "a" &&
    node.getAttribute("target") === "_blank"
  ) {
    node.setAttribute("rel", "noopener noreferrer");
  }
};

// Hooks are global on the DOMPurify instance. Registering them here at
// module scope runs once per bundle (server & client have separate
// instances). Both hooks are idempotent — even if a dev-only re-evaluation
// stacked them, the output would be identical.
DOMPurify.addHook("uponSanitizeAttribute", uponSanitizeAttribute);
DOMPurify.addHook("afterSanitizeAttributes", afterSanitizeAttributes);

/**
 * Sanitize an HTML string, stripping disallowed tags, attributes, event
 * handlers, and unsafe URLs. Safe on both server (Node) and browser.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
