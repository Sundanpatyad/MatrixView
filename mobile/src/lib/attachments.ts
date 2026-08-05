import { Directory, File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';

import type { ChatAttachment } from './api/types';
import { resolveMediaUrl } from './mediaUrl';

/** Downloads land here so repeat opens are instant and the OS can reclaim them. */
const CACHE_DIR_NAME = 'attachments';

const DOCUMENT_MIME = /pdf|document|sheet|text|msword|officedocument|presentation|csv|zip/i;

/**
 * Mirrors the backend's classifier so an optimistic attachment renders with the
 * same icon it will have once the server responds.
 */
export function attachmentKindOf(mimeType: string): ChatAttachment['kind'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (DOCUMENT_MIME.test(mimeType)) return 'document';
  return 'other';
}

function safeFileName(attachment: ChatAttachment): string {
  const cleaned = attachment.name.replace(/[^\w.\-() ]+/g, '_').trim();
  // Prefixing with the id keeps same-named files from different messages apart.
  return `${attachment.id}-${cleaned || 'file'}`;
}

function cacheDirectory(): Directory {
  const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Pulls the attachment down and hands it to the system share sheet, which is
 * what lets the user preview it, open it in another app, or save it. Falls back
 * to the browser when sharing is unavailable.
 */
export async function openAttachment(attachment: ChatAttachment): Promise<void> {
  const url = resolveMediaUrl(attachment.url);
  if (!url) return;

  if (!(await Sharing.isAvailableAsync())) {
    await Linking.openURL(url);
    return;
  }

  const target = new File(cacheDirectory(), safeFileName(attachment));

  try {
    if (!target.exists) {
      await File.downloadFileAsync(url, target);
    }
    await Sharing.shareAsync(target.uri, {
      mimeType: attachment.mimeType,
      dialogTitle: attachment.name,
      UTI: attachment.mimeType,
    });
  } catch {
    // A failed download must not dead-end the user.
    await Linking.openURL(url);
  }
}
