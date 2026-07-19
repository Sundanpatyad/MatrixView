import fs from 'node:fs/promises';
import { compressMedia, withNewExtension } from './compress.js';
import {
  deleteFromCloudinary,
  deleteFromCloudinaryByKey,
  isCloudinaryEnabled,
  isCloudinaryUrl,
  uploadToCloudinary,
} from './cloudinary.js';
import {
  deleteFromR2,
  deleteFromR2ByKey,
  deleteLocalUpload,
  isR2Enabled,
  isR2Url,
  storeLocalFile,
  uploadToR2,
} from './r2.js';

export type StorageProvider = 'cloudinary' | 'r2' | 'local';

export type StoredUpload = {
  url: string;
  size: number;
  mimeType: string;
  name: string;
  provider: StorageProvider;
  /** Cloudinary public_id or R2 object key */
  storageKey: string;
};

export type StoredMediaRef = {
  url?: string | null;
  provider?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  kind?: string | null;
};

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

function isVideo(mimeType: string) {
  return mimeType.startsWith('video/');
}

/** Chat message media + group avatars */
function isChatFolder(folder: string) {
  return folder === 'chat' || folder === 'chat-avatars';
}

/**
 * Chat images & videos → Cloudinary (when configured).
 * User avatars, task/timeline files → R2.
 * Deleting a message/attachment also deletes the blob from that provider.
 * Falls back to local /uploads if the target provider is not configured.
 */
export async function storeUploadedFile(
  file: Express.Multer.File,
  folder: string,
): Promise<StoredUpload> {
  let buffer = file.buffer ?? (file.path ? await fs.readFile(file.path) : null);
  if (!buffer) throw new Error('Upload has no file data');

  let contentType = file.mimetype || 'application/octet-stream';
  let storeName = file.originalname;

  const compressed = await compressMedia(buffer, contentType, folder);
  if (compressed) {
    buffer = compressed.buffer;
    contentType = compressed.mimeType;
    storeName = withNewExtension(file.originalname, compressed.extension);
  }

  try {
    const useCloudinary =
      isChatFolder(folder) &&
      (isImage(contentType) || isVideo(contentType)) &&
      isCloudinaryEnabled();

    if (useCloudinary) {
      const uploaded = await uploadToCloudinary(buffer, {
        folder,
        mimeType: contentType,
        fileName: storeName,
      });
      return {
        url: uploaded.url,
        size: uploaded.bytes,
        mimeType: contentType,
        name: storeName,
        provider: 'cloudinary',
        storageKey: uploaded.publicId,
      };
    }

    if (isR2Enabled()) {
      const uploaded = await uploadToR2(buffer, {
        folder,
        fileName: storeName,
        contentType,
      });
      return {
        url: uploaded.url,
        size: uploaded.size,
        mimeType: contentType,
        name: storeName,
        provider: 'r2',
        storageKey: uploaded.key,
      };
    }

    const local = await storeLocalFile(buffer, storeName);
    return {
      url: local.url,
      size: local.size,
      mimeType: contentType,
      name: storeName,
      provider: 'local',
      storageKey: local.url.replace(/^\/uploads\//, ''),
    };
  } finally {
    if (file.path) await fs.unlink(file.path).catch(() => undefined);
  }
}

/** Delete one media object from Cloudinary, R2, or local disk. */
export async function deleteStoredMedia(url: string | null | undefined): Promise<void> {
  await deleteStoredMediaRef({ url });
}

export async function deleteStoredMediaRef(ref: StoredMediaRef): Promise<void> {
  const url = ref.url ?? undefined;
  const provider = ref.provider ?? undefined;
  const key = ref.storageKey ?? undefined;
  const resourceHint =
    ref.kind === 'video' || ref.mimeType?.startsWith('video/')
      ? 'video'
      : ref.kind === 'image' || ref.mimeType?.startsWith('image/')
        ? 'image'
        : undefined;

  if (provider === 'cloudinary' && key) {
    await deleteFromCloudinaryByKey(key, resourceHint);
    return;
  }
  if (provider === 'r2' && key) {
    await deleteFromR2ByKey(key);
    return;
  }
  if (provider === 'local' && (key || url)) {
    await deleteLocalUpload(url?.startsWith('/uploads/') ? url : `/uploads/${key}`);
    return;
  }

  // Fallback by URL (older records without provider/key)
  if (url && isCloudinaryUrl(url)) {
    await deleteFromCloudinary(url, resourceHint);
    return;
  }
  if (url && isR2Url(url)) {
    await deleteFromR2(url);
    return;
  }
  if (url) await deleteLocalUpload(url);
}

export async function deleteStoredMediaMany(
  refs: Array<string | StoredMediaRef | null | undefined>,
): Promise<void> {
  const normalized: StoredMediaRef[] = [];
  for (const r of refs) {
    if (!r) continue;
    if (typeof r === 'string') normalized.push({ url: r });
    else if (r.url || r.storageKey) normalized.push(r);
  }
  // Dedupe by url or storageKey
  const seen = new Set<string>();
  const unique = normalized.filter((r) => {
    const id = r.storageKey || r.url || '';
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  await Promise.all(unique.map((r) => deleteStoredMediaRef(r)));
}
