/**
 * Copy text to the clipboard with a fallback for plain-HTTP (non-secure
 * context) installs where `navigator.clipboard` is unavailable.
 *
 * Tries the async Clipboard API first (only available in secure contexts),
 * then falls back to a hidden textarea + document.execCommand('copy').
 *
 * Returns true when the copy succeeded, false otherwise. Never throws.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    try {
      textarea.select();
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  } catch {
    return false;
  }
}