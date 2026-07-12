/**
 * Copy text to clipboard with multiple fallback strategies.
 *
 * 1. navigator.clipboard.writeText (modern, requires HTTPS + permission)
 * 2. document.execCommand("copy") via temporary textarea (legacy fallback)
 * 3. window.prompt (last resort — user copies manually)
 *
 * Returns true if copied successfully, false if the prompt fallback was used.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Strategy 1: modern Clipboard API.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy approach
  }

  // Strategy 2: legacy textarea + execCommand.
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (ok) return true;
  } catch {
    // fall through to prompt
  }

  // Strategy 3: prompt the user to copy manually.
  window.prompt("Salin teks ini (Ctrl+C lalu Enter):", text);
  return false;
}
