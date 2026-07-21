/**
 * Trigger a browser download for a generated file.
 *
 * Keep this DOM-specific behavior outside feature state hooks so exports can be
 * tested and reused without coupling them to resume editor orchestration.
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Firefox and WebKit can still be consuming the object URL after the
  // synthetic click returns. Revoke it shortly afterward so downloads remain
  // reliable without retaining generated files for the rest of the session.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJsonFile(data: unknown, filename: string) {
  downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}

export function downloadTextFile(text: string, filename: string) {
  downloadFile(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
}

export function downloadMarkdownFile(text: string, filename: string) {
  downloadFile(new Blob([text], { type: "text/markdown;charset=utf-8" }), filename);
}

/**
 * Clipboard access can be unavailable in a privacy-restricted browser or an
 * embedded context. Prefer the async API, then use the user-gesture copy path
 * as a narrow fallback.
 */
export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the synchronous browser fallback below.
    }
  }

  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.readOnly = true;
  fallback.setAttribute("aria-hidden", "true");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  fallback.style.pointerEvents = "none";

  // A modal focus trap can immediately pull focus away from a control added to
  // body, leaving the legacy copy command with no selected text.
  const fallbackContainer = activeElement?.closest<HTMLElement>("[role=dialog]") ?? document.body;
  fallbackContainer.appendChild(fallback);
  fallback.focus();
  fallback.select();
  fallback.setSelectionRange(0, fallback.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    fallback.remove();
    activeElement?.focus();
  }
}

export function safeFilename(name: string, fallback = "download") {
  return (
    name
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || fallback
  );
}
