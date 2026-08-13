/**
 * Web-safe share utility.
 *
 * On native, uses React Native's Share API.
 * On web, tries navigator.share() first (works on mobile browsers),
 * then falls back to clipboard copy (needed for cross-origin iframes
 * like the Rork preview where navigator.share throws NotAllowedError).
 */
import { Platform, Share } from 'react-native';

export interface ShareResult {
  success: boolean;
  method: 'native' | 'web-share' | 'clipboard';
}

/**
 * Share a message. On web, falls back to clipboard if Web Share API is unavailable.
 */
export async function shareContent(message: string): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    const result = await Share.share({ message });
    return { success: result.action === Share.sharedAction, method: 'native' };
  }

  // Web: try Web Share API first
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message });
      return { success: true, method: 'web-share' };
    } catch (err) {
      // NotAllowedError or AbortError — fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(message);
  } else {
    // Legacy fallback
    const textarea = document.createElement('textarea');
    textarea.value = message;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  return { success: true, method: 'clipboard' };
}
