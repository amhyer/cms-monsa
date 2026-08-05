import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("preserves allowed HTML tags", () => {
    expect(sanitizeHtml("<p>Hello</p>")).toBe("<p>Hello</p>");
  });

  it("preserves bold and italic", () => {
    expect(sanitizeHtml("<strong>bold</strong>")).toBe("<strong>bold</strong>");
    expect(sanitizeHtml("<em>italic</em>")).toBe("<em>italic</em>");
  });

  it("preserves headings", () => {
    expect(sanitizeHtml("<h2>Title</h2>")).toBe("<h2>Title</h2>");
    expect(sanitizeHtml("<h3>Subtitle</h3>")).toBe("<h3>Subtitle</h3>");
  });

  it("preserves lists", () => {
    const input = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("preserves links with http href", () => {
    const input = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("preserves links with relative href", () => {
    const input = '<a href="/about">Link</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("removes script tags entirely", () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).not.toContain("<script>");
    expect(sanitizeHtml('<script>alert("xss")</script>')).not.toContain("alert");
  });

  it("removes style tags", () => {
    expect(sanitizeHtml('<style>body{color:red}</style>')).not.toContain("<style>");
  });

  it("removes event handler attributes", () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
  });

  it("removes javascript: URLs in href", () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("removes data: URLs in src", () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data:");
  });

  it("allows https URLs", () => {
    const input = '<a href="https://example.com">Link</a>';
    expect(sanitizeHtml(input)).toContain("https://example.com");
  });

  it("allows mailto URLs", () => {
    const input = '<a href="mailto:test@example.com">Email</a>';
    expect(sanitizeHtml(input)).toContain("mailto:");
  });

  it("strips disallowed tags but keeps text content", () => {
    const input = "<div>Hello <script>bad</script> World</div>";
    const result = sanitizeHtml(input);
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    expect(result).not.toContain("<script>");
  });

  it("adds rel=noopener noreferrer to target=_blank links", () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("only allows _blank for target attribute", () => {
    const input = '<a href="https://example.com" target="_self">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("target=");
  });

  it("sanitizes style attributes to safe properties only", () => {
    const input = '<span style="text-align: center; background-image: url(x)">Text</span>';
    const result = sanitizeHtml(input);
    expect(result).toContain("text-align");
    expect(result).not.toContain("background-image");
  });

  it("preserves table elements", () => {
    const input = "<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>";
    expect(sanitizeHtml(input)).toContain("<table>");
    expect(sanitizeHtml(input)).toContain("<td>");
    expect(sanitizeHtml(input)).toContain("<th>");
  });

  it("handles nested HTML correctly", () => {
    const input = "<div><p><strong>Bold in paragraph</strong></p></div>";
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("handles plain text without HTML", () => {
    expect(sanitizeHtml("Just plain text")).toBe("Just plain text");
  });

  // --- Regression tests for C1 (regex fallback bypasses) ---
  // The old regex fallback could be tricked by nested/obfuscated markup;
  // DOMPurify parses with a real DOM, so none of these must survive.

  it("blocks nested script tags (parser bypass attempt)", () => {
    const input = "<scr<script>ipt>alert(1)</script>";
    const result = sanitizeHtml(input);
    expect(result).not.toMatch(/<\s*script/i);
    expect(result).not.toMatch(/on\w+\s*=/i);
  });

  it("removes scripts inside SVG", () => {
    const result = sanitizeHtml("<svg><script>alert(1)</script></svg>");
    expect(result).not.toContain("svg");
    expect(result).not.toMatch(/<\s*script/i);
  });

  it("blocks entity-encoded javascript: URLs", () => {
    const result = sanitizeHtml(
      '<a href="java&#x73;cript:alert(1)">Click</a>'
    );
    expect(result).not.toMatch(/javascript\s*:/i);
  });

  it("blocks mixed-case and numeric-entity javascript: URLs", () => {
    expect(sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).not.toMatch(
      /javascript\s*:/i
    );
    expect(sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>')).not.toMatch(
      /javascript\s*:/i
    );
  });

  it("removes unquoted event handlers", () => {
    const result = sanitizeHtml("<img src=x onerror=alert(1)>");
    expect(result).not.toMatch(/onerror/i);
  });

  it("removes unsafe CSS such as position:fixed phishing overlays", () => {
    const input =
      '<div style="position:fixed;top:0;left:0;width:100%;height:100%">phishing</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("position");
    expect(result).toContain("phishing");
  });

  it("keeps only safe style declarations", () => {
    const result = sanitizeHtml('<span style="color:red;position:absolute">t</span>');
    expect(result).toContain("color");
    expect(result).not.toContain("position");
  });

  it("drops iframe/object/embed entirely", () => {
    const result = sanitizeHtml(
      '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="y">'
    );
    expect(result).not.toMatch(/<\s*(iframe|object|embed)/i);
  });
});
