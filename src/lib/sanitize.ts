/**
 * Minimal HTML sanitizer for user-supplied rich-text content (news articles).
 *
 * Goal: prevent stored XSS while preserving common formatting. We allow a
 * conservative set of tags/attributes and strip everything else — including
 * <script>, event handlers (onerror, onload, …), and javascript: URLs.
 *
 * This runs server-side before storing to DB so the sanitized HTML is what
 * gets rendered via dangerouslySetInnerHTML on the public news detail page.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike",
  "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  span: new Set(["style"]),
  div: new Set(["style"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

// Allow only safe inline styles (text alignment, basic spacing).
const SAFE_STYLE = /^(text-align|padding|margin|font-weight|font-style|color|background-color)\s*:/i;

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  // Block javascript: and data: URLs (data: can carry XSS in some contexts).
  if (trimmed.startsWith("javascript:") || trimmed.startsWith("data:")) {
    return false;
  }
  // Allow http(s), relative, and anchor URLs.
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    !trimmed.includes(":")
  );
}

function sanitizeAttributes(tag: string, attrName: string, attrValue: string): string | null {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed || !allowed.has(attrName)) return null;

  // Block event handlers regardless of allow-list (defense in depth).
  if (attrName.startsWith("on")) return null;

  if (attrName === "href" || attrName === "src") {
    if (!isSafeUrl(attrValue)) return null;
    return attrValue;
  }

  if (attrName === "style") {
    // Keep only declarations that match the safe-style allow-list.
    const safe = attrValue
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d && SAFE_STYLE.test(d))
      .join("; ");
    return safe || null;
  }

  if (attrName === "target") {
    // Only allow _blank (with rel=noreferrer enforced below).
    return attrValue === "_blank" ? "_blank" : null;
  }

  return attrValue;
}

/**
 * Sanitize an HTML string. Strips disallowed tags (keeping their text
 * content), disallowed attributes, event handlers, and unsafe URLs.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  try {
    // Use the DOMParser available in Node 20+ via the global scope when
    // running in the Next.js server runtime. Fall back to regex-based
    // stripping if the DOM API is not available.
    if (typeof globalThis.DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return sanitizeNode(doc.body);
    }
    return sanitizeRegex(html);
  } catch {
    // If anything throws, fall back to a strict regex strip of the most
    // dangerous patterns so we never store raw untrusted HTML.
    return sanitizeRegex(html);
  }
}

function sanitizeNode(node: Element): string {
  // Process children first (depth-first), collecting sanitized output.
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      out += child.textContent ?? "";
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (ALLOWED_TAGS.has(tag)) {
        const inner = sanitizeNode(el);
        const attrs = collectAttrs(tag, el);
        out += `<${tag}${attrs}>${inner}</${tag}>`;
      } else {
        // Disallowed tag: keep its text content (strip the tag itself).
        out += sanitizeNode(el);
      }
    }
  });
  return out;
}

function collectAttrs(tag: string, el: Element): string {
  let attrs = "";
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    const safe = sanitizeAttributes(tag, name, value);
    if (safe !== null) {
      attrs += ` ${name}="${escapeAttr(safe)}"`;
      // Force rel on target=_blank links for safety.
      if (name === "target" && safe === "_blank" && tag === "a") {
        attrs += ` rel="noopener noreferrer"`;
      }
    }
  }
  return attrs;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Regex fallback used when the DOM API is unavailable. */
function sanitizeRegex(html: string): string {
  let s = html;
  // Drop <script> and <style> blocks entirely.
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  // Remove all on* event handler attributes.
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  // Block javascript: and data: URLs in href/src.
  s = s.replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"');
  s = s.replace(/(href|src)\s*=\s*"\s*data:[^"]*"/gi, '$1="#"');
  s = s.replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");
  s = s.replace(/(href|src)\s*=\s*'\s*data:[^']*'/gi, "$1='#'");
  return s;
}
