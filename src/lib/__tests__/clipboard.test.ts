import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyToClipboard } from "@/lib/clipboard";

// ── DOM setup ─────────────────────────────────────────────────────

beforeEach(() => {
  // Ensure body exists
  if (!document.body) {
    document.body = document.createElement("body");
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Strategy 1: Modern Clipboard API ──────────────────────────────
describe("copyToClipboard — modern Clipboard API", () => {
  it("uses navigator.clipboard.writeText when available & secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true });
    window.isSecureContext = true;

    const result = await copyToClipboard("hello");

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result).toBe(true);
  });

  it("falls through when navigator.clipboard is undefined", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, writable: true });
    window.isSecureContext = true;

    // execCommand fallback will be used
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard("fallback");

    expect(result).toBe(true);
  });

  it("falls through when navigator.clipboard.writeText throws", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true });
    window.isSecureContext = true;

    // execCommand fallback will be used
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard("fallback");

    expect(result).toBe(true);
  });

  it("falls through when isSecureContext is false", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true });
    window.isSecureContext = false;

    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard("no-secure");

    expect(writeText).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

// ── Strategy 2: Legacy textarea + execCommand ─────────────────────
describe("copyToClipboard — legacy textarea fallback", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, writable: true });
  });

  it("creates a hidden textarea, selects and copies, then removes it", async () => {
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard("test value");

    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("appends textarea to document body with correct styling", async () => {
    document.execCommand = vi.fn().mockReturnValue(true);
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    await copyToClipboard("styled");

    const textarea = appendSpy.mock.calls[0][0] as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.value).toBe("styled");
    expect(textarea.style.position).toBe("fixed");
    expect(textarea.style.left).toBe("-9999px");
    expect(textarea.getAttribute("readonly")).toBe("");
    expect(removeSpy).toHaveBeenCalled();
  });

  it("returns false when execCommand returns false", async () => {
    document.execCommand = vi.fn().mockReturnValue(false);

    const result = await copyToClipboard("nope");

    expect(result).toBe(false);
  });

  it("falls through to prompt when execCommand throws", async () => {
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error("execCommand not supported");
    });
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);

    const result = await copyToClipboard("prompt text");

    expect(result).toBe(false);
    expect(promptSpy).toHaveBeenCalledWith(
      "Salin teks ini (Ctrl+C lalu Enter):",
      "prompt text"
    );
  });
});

// ── Strategy 3: window.prompt last resort ──────────────────────────
describe("copyToClipboard — prompt fallback", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, writable: true });
  });

  it("calls window.prompt with the text and returns false", async () => {
    document.execCommand = vi.fn().mockReturnValue(false);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);

    const result = await copyToClipboard("manual copy");

    expect(promptSpy).toHaveBeenCalledWith(
      "Salin teks ini (Ctrl+C lalu Enter):",
      "manual copy"
    );
    expect(result).toBe(false);
  });

  it("handles empty text gracefully", async () => {
    document.execCommand = vi.fn().mockReturnValue(false);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);

    const result = await copyToClipboard("");

    expect(promptSpy).toHaveBeenCalledWith("Salin teks ini (Ctrl+C lalu Enter):", "");
    expect(result).toBe(false);
  });

  it("handles multiline text", async () => {
    document.execCommand = vi.fn().mockReturnValue(false);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);

    const multiline = "line1\nline2\nline3";
    await copyToClipboard(multiline);

    expect(promptSpy).toHaveBeenCalledWith(
      "Salin teks ini (Ctrl+C lalu Enter):",
      multiline
    );
  });
});
