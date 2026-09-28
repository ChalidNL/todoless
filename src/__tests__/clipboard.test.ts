import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from '../lib/clipboard';

describe('copyTextToClipboard', () => {
  const originalClipboard = navigator.clipboard;
  const originalIsSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');

  beforeEach(() => {
    vi.restoreAllMocks();
    // Default jsdom state: non-secure context with no Clipboard API.
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });

  afterEach(() => {
    if (originalClipboard !== undefined) {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
    }
    if (originalIsSecureContext) {
      Object.defineProperty(window, 'isSecureContext', originalIsSecureContext);
    }
  });

  it('uses the Clipboard API in secure contexts and returns true', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    const result = await copyTextToClipboard('https://example.test/register?invite=ABC');

    expect(writeText).toHaveBeenCalledWith('https://example.test/register?invite=ABC');
    expect(result).toBe(true);
  });

  it('falls back to a hidden textarea + execCommand on plain-HTTP installs and returns true', async () => {
    const execMock = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execMock });
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    const result = await copyTextToClipboard('https://example.test/register?invite=ABC');

    expect(execMock).toHaveBeenCalledWith('copy');
    const textarea = appendSpy.mock.calls[0][0] as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('https://example.test/register?invite=ABC');
    expect(textarea.getAttribute('readonly')).toBe('');
    expect(removeSpy).toHaveBeenCalledWith(textarea);
    expect(result).toBe(true);
  });

  it('returns false when execCommand reports failure', async () => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) });

    const result = await copyTextToClipboard('https://example.test/register?invite=ABC');

    expect(result).toBe(false);
  });

  it('cleans up the fallback textarea even when execCommand throws', async () => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => {
      throw new Error('execCommand unavailable');
    }) });
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    const result = await copyTextToClipboard('https://example.test/register?invite=ABC');

    expect(result).toBe(false);
    expect(removeSpy).toHaveBeenCalled();
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  it('returns false when the Clipboard API rejects', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    const result = await copyTextToClipboard('https://example.test/register?invite=ABC');

    expect(writeText).toHaveBeenCalled();
    expect(result).toBe(false);
  });
});